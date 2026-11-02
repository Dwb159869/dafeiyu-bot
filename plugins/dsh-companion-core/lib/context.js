// 预设里的「上下文管理」行（插件名 dsh-companion-core/context），替换 dsh 自带的 compaction-basic。
//
// 继承 dsh 自带的 BasicCompactionEngine：日志里的压缩事务、加锁、替换、/compact 命令都用它的，
// 只改三件事：
//   1. 什么时候处理：超过「最多保留轮数」或上下文到了模型上限的 70%（哪个先到算哪个）；
//   2. 处理哪段：最早的 N 轮（「一次处理几轮」），切口不拆开工具调用；
//   3. 怎么处理：按轮数截断（留一句"已省略"），或者让模型用中文、她的第一人称写一份回忆。
// 模型报"超出上限"时不管设的是哪种方式，都立刻按轮数截断再重试（dsh 自带的重试机制会再发一次）。
import { BasicCompactionEngine } from '@deepseek-ai/dsh-compaction-basic';
import { toolPairingBalancedBefore } from '@deepseek-ai/dsh-compaction';
import { BlockAssembler, LlmError, contentHasImage } from '@deepseek-ai/dsh-llm';
import { countRounds, isHumanTurn, pendingHumanTurn, selectRounds, SUMMARY_INSTRUCTION, truncationNote } from './rounds.js';
import { chatComplete } from './chat.js';
import { effortFor } from './extract.js';
/** 用别家模型压缩时，把会话消息摊平成文字（别家接口看不懂 dsh 的工具调用和附件格式）。 */
function transcriptText(messages) {
    const out = [];
    for (const m of messages) {
        const blocks = Array.isArray(m?.content) ? m.content : [{ type: 'text', text: String(m?.content ?? '') }];
        const parts = [];
        for (const b of blocks) {
            if (b?.type === 'text' && String(b.text ?? '').trim())
                parts.push(String(b.text));
            else if (b?.type === 'tool-call' || b?.type === 'tool_use')
                parts.push('[调用工具 ' + String(b.name ?? b.toolName ?? '') + ']');
            else if (b?.type === 'tool-result' || b?.type === 'tool_result')
                parts.push('[工具结果] ' + String(typeof b.content === 'string' ? b.content : JSON.stringify(b.content ?? b.output ?? '')).slice(0, 2000));
            else if (b?.type === 'image')
                parts.push('[图片]');
        }
        if (parts.length > 0)
            out.push('[' + String(m?.role ?? '') + '] ' + parts.join('\n'));
    }
    return out.join('\n\n');
}
export const name = 'companion-context';
/** 没有常驻部分（没装好或被关掉）时用的默认值。 */
const FALLBACK = { rule: { maxRounds: 60, dropRounds: 20, mode: 'llm' }, thresholdPercent: 70 };
/** 一次检查里最多连续处理几次（每次 N 轮），防止死循环。 */
const MAX_PASSES = 4;
/** 等「处理之前」监听者最多多久。 */
const BEFORE_COMPACT_MS = 60_000;
const errText = (e) => (e instanceof Error ? e.message : String(e));
export class CompanionContextEngine extends BasicCompactionEngine {
    /** 正在进行的处理用哪种方式（summarize 钩子里读）。 */
    pending = new WeakMap();
    service() {
        return this.ctx.get('companion');
    }
    policy(agent) {
        const session = agent.session;
        const svc = this.service();
        if (svc === undefined)
            return { scope: { category: 'master', qq: false }, ...FALLBACK };
        return svc.contextPolicy(String(session.id), session.meta?.agentPreset);
    }
    log(level, message) {
        const svc = this.service();
        if (svc !== undefined)
            svc.log(level, message);
        else
            this.ctx.logger?.[level === 'debug' ? 'debug' : level]?.(message);
    }
    /** 这一段里人说的话和她的回复，给「处理之前」的监听者（记忆）用。 */
    transcript(session, range) {
        const out = [];
        let inside = false;
        for (const seq of session.surface.nodes) {
            if (seq === range.start)
                inside = true;
            if (inside) {
                const ev = session.eventAt(seq);
                const msg = ev?.type === 'user/message' || ev?.type === 'assistant/message' ? ev.data : undefined;
                const text = Array.isArray(msg?.content) ? msg.content.filter((b) => b?.type === 'text').map((b) => String(b.text)).join('\n').trim() : '';
                if (text !== '' && (ev.type === 'assistant/message' || isHumanTurn(ev)))
                    out.push((ev.type === 'assistant/message' ? '[她] ' : '[对方] ') + text);
            }
            if (seq === range.end)
                break;
        }
        return out;
    }
    async notify(svc, payload) {
        if (svc === undefined)
            return;
        let timer;
        try {
            await Promise.race([svc.beforeCompact(payload), new Promise(r => { timer = setTimeout(r, BEFORE_COMPACT_MS); })]);
        }
        catch (e) {
            this.log('warn', '「处理之前」监听器出错，照常处理: ' + errText(e));
        }
        finally {
            if (timer !== undefined)
                clearTimeout(timer);
        }
    }
    /** 处理一段：先通知，再交给 dsh 的压缩事务（summarize 里按 pending 决定截断还是写回忆）。 */
    async process(agent, policy, range, mode, reason, signal) {
        const session = agent.session;
        this.log('debug', '会话 ' + session.id + ' 处理节点 ' + range.start + '–' + range.end + '（' + range.rounds + ' 轮，' + mode + '）');
        await this.notify(this.service(), { sessionId: String(session.id), scope: policy.scope, mode, reason, transcript: this.transcript(session, range) });
        this.pending.set(session, { mode, rounds: range.rounds });
        try {
            const result = await this.compactRegion(range.start, range.end, agent, signal);
            this.log('info', '会话 ' + session.id + '：' + (mode === 'truncate' ? '截掉' : '压缩') + '了最早的 ' + range.rounds + ' 轮（' + reason + '）');
            return result;
        }
        finally {
            this.pending.delete(session);
        }
    }
    /** 上下文现在占模型上限的多少（0–1）；拿不到模型信息时 undefined。 */
    async pressure(agent, signal) {
        const header = agent.session.requestHeader?.()?.config;
        const provider = header?.provider || agent.options.provider;
        const model = header?.model || agent.options.model;
        if (!provider || !model)
            return undefined;
        try {
            const info = await this.ctx.llm.resolveModelInfo(provider, model, signal);
            const window = info?.context?.contextWindow;
            if (typeof window !== 'number' || window <= 0)
                return undefined;
            return this.ctx.tokenMeter.measure(agent.session).totalTokens / window;
        }
        catch {
            return undefined;
        }
    }
    async compactIfNeeded(agent, trigger, signal) {
        const policy = this.policy(agent);
        // 不归插件二管的会话：完全按 dsh 自带的方式
        if (policy === undefined)
            return super.compactIfNeeded(agent, trigger, signal);
        const session = agent.session;
        const balanced = (seq) => toolPairingBalancedBefore(session, seq);
        const surface = session;
        const rule = policy.rule;
        const drop = Math.max(1, rule.dropRounds);
        if (trigger === 'context-overflow') {
            // 必做：超出上限时不管设的是哪种方式，立刻按轮数截断，dsh 会再发一次请求
            const range = selectRounds(surface, drop, balanced) ?? selectRounds(surface, Number.MAX_SAFE_INTEGER, balanced);
            if (range === null) {
                this.log('warn', '会话 ' + session.id + ' 超出上限，但只剩一轮，没法再截');
                return null;
            }
            return this.process(agent, policy, range, 'truncate', 'overflow', signal);
        }
        const ratio = Math.min(Math.max(policy.thresholdPercent, 10), 95) / 100;
        let result = null;
        for (let pass = 0; pass < MAX_PASSES; pass++) {
            // 新一轮刚开始时，正在进来的这条也算一轮
            const rounds = countRounds(surface) + (pendingHumanTurn(surface) ? 1 : 0);
            const overRounds = rule.maxRounds > 0 && rounds > rule.maxRounds;
            const load = await this.pressure(agent, signal);
            const overTokens = load !== undefined && load >= ratio;
            this.log('debug', '会话 ' + session.id + '：' + rounds + ' 轮（上限 ' + rule.maxRounds + '），上下文 ' + (load === undefined ? '未知' : Math.round(load * 100) + '%'));
            if (!overRounds && !overTokens)
                return result;
            const range = selectRounds(surface, drop, balanced);
            if (range === null)
                return result;
            result = await this.process(agent, policy, range, rule.mode, overRounds ? 'rounds' : 'pressure', signal);
        }
        return result;
    }
    /** dsh 压缩事务调用的唯一钩子：截断时直接给一句话，LLM 压缩时用中文第一人称的指令。 */
    async summarize(input, agent, signal) {
        const pending = this.pending.get(agent.session);
        if (pending?.mode === 'truncate') {
            return { summary: [{ type: 'text', text: truncationNote(pending.rounds) }], provider: 'companion', model: 'truncate' };
        }
        const policy = this.policy(agent);
        const header = agent.session.requestHeader?.()?.config;
        const target = policy?.summaryModel
            ?? (header?.provider && header?.model ? { provider: header.provider, model: header.model } : undefined)
            ?? (agent.options.provider && agent.options.model ? { provider: agent.options.provider, model: agent.options.model } : undefined);
        if (target === undefined)
            throw new Error('没有可用的模型来压缩：请在设置里选「压缩用的模型」');
        const maxTokens = this.config?.maxTokens ?? 8192;
        if ('api' in target && target.api !== undefined) {
            // 别家模型：把要压缩的对话摊平成文字再交给它
            const text = await chatComplete(target.api, transcriptText(input.messages) + '\n\n' + SUMMARY_INSTRUCTION, maxTokens, signal);
            return { summary: [{ type: 'text', text }], provider: 'api', model: target.model, maxTokens };
        }
        const effort = 'effort' in target ? await effortFor(this.ctx.llm, target) : undefined;
        const assembler = new BlockAssembler();
        const options = {
            provider: target.provider,
            model: target.model,
            ...(effort === undefined ? {} : { reasoningEffort: effort }),
            messages: [...input.messages, { role: 'user', content: [{ type: 'text', text: SUMMARY_INSTRUCTION }] }],
            toolHistory: agent.session.toolHistory(),
            ...(input.tools === undefined ? {} : { tools: [...input.tools] }),
            maxTokens,
            sessionId: agent.session.id,
            purpose: 'compaction',
            ...(signal === undefined ? {} : { signal }),
        };
        for await (const chunk of this.ctx.llm.stream(options))
            assembler.push(chunk);
        const finish = assembler.finish;
        if (finish.kind === 'error' || finish.kind === 'aborted')
            throw new LlmError(finish.failure.message, finish.failure.code, finish.failure);
        if (finish.kind === 'max-tokens')
            throw new Error('写回忆时超出了输出长度上限');
        const raw = assembler.blocks();
        if (contentHasImage(raw))
            throw new Error('回忆里不能有图片');
        const summary = raw.filter((b) => b.type === 'text');
        if (!summary.some((b) => String(b.text ?? '').trim() !== ''))
            throw new Error('模型没有写出回忆');
        return {
            summary, rawOutput: raw, llmStreamCall: true, provider: target.provider, model: target.model, maxTokens,
            ...(assembler.usage === undefined ? {} : { usage: assembler.usage }),
        };
    }
}
export default CompanionContextEngine;
