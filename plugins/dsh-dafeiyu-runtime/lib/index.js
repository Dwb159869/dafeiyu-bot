import fs from 'node:fs/promises';
import path from 'node:path';
import z from '@deepseek-ai/schemastery';
import { qqOwner, recurringBatch, coalesceRecurring, qqQuestionResult } from './qq-runtime-policy.js';

export const name = 'dafeiyu-qq-runtime';
export const inject = ['tools', 'napcat', 'agents', 'permissionPresets'];
export const Config = z.object({
    root: z.string().default('/workspace/vault'),
    owners: z.array(z.string()).default([]),
    toolTimeoutMs: z.number().min(1000).max(600000).default(120000),
});
export async function apply(ctx, config) {
    const dir = path.join(config.root, '04工作区', '系统任务', '会话运行状态');
    await fs.mkdir(dir, { recursive: true });
    const tracked = new Map();
    let writeQueue = Promise.resolve(), disposed = false;
    const info = agent => ctx.get('napcat')?.sessionInfo?.(String(agent?.session?.id ?? ''));
    const audit = record => {
        if (disposed) return;
        writeQueue = writeQueue.then(() => fs.appendFile(path.join(dir, 'events.jsonl'), JSON.stringify({ at: new Date().toISOString(), ...record }) + '\n')).catch(error => ctx.logger.warn('QQ runtime audit: ' + error.message));
    };
    function permissions(agent) {
        if (!qqOwner(info(agent), config.owners)) return;
        const presets = ctx.get('permissionPresets');
        if (presets.current(agent.session) !== 'danger-full-access') {
            presets.set(agent.session, 'danger-full-access');
            audit({ sessionId: String(agent.session.id), event: 'full-access-applied' });
        }
    }
    function attach(agent) {
        if (!agent?.session || !info(agent)) return;
        permissions(agent);
        if (tracked.has(agent)) return;
        const state = { sessionId: String(agent.session.id), activeIds: new Set(), phase: agent.status, lastEventAt: Date.now(), interceptedQuestions: 0, coalescedReminders: 0, skippedReminders: 0 };
        const original = agent.followup;
        function followup(input) {
            const decision = coalesceRecurring(agent, input, state.activeIds);
            state.coalescedReminders += decision.removed;
            state.skippedReminders += decision.skipped.length;
            if (decision.removed || decision.skipped.length) audit({ sessionId: state.sessionId, event: 'recurring-coalesced', removed: decision.removed, skippedIds: decision.skipped });
            if (decision.message) return original.call(agent, decision.message);
        }
        state.restore = () => { if (agent.followup === followup) agent.followup = original; };
        agent.followup = followup;
        tracked.set(agent, state);
    }
    function attachAll() { for (const item of ctx.get('agents')?.list?.() ?? []) attach(item.agent ?? item); }
    ctx.on('agent/created', p => attach(p.agent ?? p));
    ctx.on('napcat/prompt', () => attachAll());
    ctx.on('agent/pre-step', ({ agent }, next) => { attach(agent); return next(); });
    ctx.on('tools/execute', async (exec, next) => {
        if (!info(exec.agent)) return next();
        attach(exec.agent);
        const state = tracked.get(exec.agent);
        if (exec.name === 'ask_user_question') {
            state.interceptedQuestions++;
            audit({ sessionId: state.sessionId, event: 'ui-question-returned-to-qq', callId: exec.callId });
            return qqQuestionResult(!!qqOwner(info(exec.agent), config.owners));
        }
        const originalSignal = exec.signal;
        const controller = new AbortController();
        const limit = config.toolTimeoutMs ?? 120000;
        let expired = false, grace;
        state.activeTool = exec.name; state.toolStartedAt = Date.now(); state.phase = 'tool';
        const timer = setTimeout(() => {
            expired = true; state.phase = 'cancelling';
            controller.abort(new Error('QQ tool deadline exceeded; inspect actual results before retrying'));
            audit({ sessionId: state.sessionId, event: 'tool-deadline', tool: exec.name, limitMs: limit });
            grace = setTimeout(() => exec.agent.cancel({ kind: 'hook', reason: 'QQ tool cancellation did not settle within 10 seconds' }, { keepInbox: true }), 10000);
            grace.unref();
        }, limit);
        timer.unref();
        exec.signal = AbortSignal.any([originalSignal, controller.signal]);
        try {
            const result = await next();
            if (!expired) return result;
            const message = '工具已超时并取消，部分动作可能已经发生；先检查实际状态，禁止盲目重复执行。';
            return { isError: true, error: { message }, content: [{ type: 'text', text: message }] };
        } finally {
            clearTimeout(timer); clearTimeout(grace); exec.signal = originalSignal;
            state.activeTool = undefined; state.toolStartedAt = undefined; state.phase = expired ? 'timeout' : exec.agent.status;
            state.lastEventAt = Date.now();
        }
    });
    ctx.on('session/event', (session, event) => {
        for (const [agent, state] of tracked) {
            if (String(session.id) !== state.sessionId) continue;
            state.lastEventAt = Date.now(); state.lastEvent = event.type;
            if (event.type === 'turn/start') { state.activeIds.clear(); state.phase = 'running'; }
            if (event.type === 'user/message') for (const r of recurringBatch(event.data) ?? []) state.activeIds.add(r.schedule_id);
            if (event.type === 'turn/end') { state.activeIds.clear(); state.phase = 'idle'; }
        }
    });
    async function snapshot() {
        attachAll();
        const agents = [...tracked].map(([agent, s]) => ({
            sessionId: s.sessionId, status: agent.status, phase: s.phase, lastEventAt: s.lastEventAt,
            lastEvent: s.lastEvent, activeTool: s.activeTool, toolStartedAt: s.toolStartedAt,
            permissions: ctx.get('permissionPresets').current(agent.session),
            queueDepth: agent.inbox.nextStep.length + agent.inbox.nextTurn.length,
            recurringPending: [...agent.inbox.nextStep, ...agent.inbox.nextTurn].reduce((n, m) => n + (recurringBatch(m)?.length ?? 0), 0),
            interceptedQuestions: s.interceptedQuestions, coalescedReminders: s.coalescedReminders, skippedReminders: s.skippedReminders,
        }));
        await fs.writeFile(path.join(dir, 'runtime.json'), JSON.stringify({ ready: true, at: new Date().toISOString(), toolTimeoutMs: config.toolTimeoutMs ?? 120000, agents }, null, 2));
    }
    ctx.effect(() => {
        const timer = setInterval(() => { void snapshot().catch(e => audit({ event: 'health-error', message: e.message })); }, 10000);
        timer.unref();
        return async () => { clearInterval(timer); for (const s of tracked.values()) s.restore(); disposed = true; await writeQueue; };
    });
    await snapshot();
}
