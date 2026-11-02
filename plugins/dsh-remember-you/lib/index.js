import fs from 'node:fs/promises';
import path from 'node:path';
import z from '@deepseek-ai/schemastery';
import { defineTool } from '@deepseek-ai/dsh-tools';
import { RememberEngine, visible, REALITIES, SLOTS } from './engine.js';
import { page } from './page.js';

export const name = 'remember-you';
export const inject = ['companionMemory', 'napcat', 'tools'];
export const Config = z.object({
    root: z.string().default('/workspace/vault'),
    owners: z.array(z.string()).default([]),
    budgetChars: z.number().min(300).max(1600).default(800),
});
const master = { category: 'master', qq: false };
export async function apply(ctx, config) {
    const bridge = ctx.get('companionMemory');
    const engine = new RememberEngine(bridge.store, config);
    const restore = engine.wrapWrites(), equipped = new Map();
    const dir = path.join(config.root, '04工作区', '记忆管理', 'RememberYou');
    await fs.mkdir(dir, { recursive: true });
    const rows = () => bridge.store.db.prepare('SELECT id FROM memories ORDER BY created_at DESC,id DESC').all()
        .map(r => bridge.store.get(Number(r.id))).filter(m => visible(m, master))
        .map(m => ({ ...m, quality: engine.meta(m) }));
    const service = {
        select: options => engine.select(options),
        format: items => engine.format(items).text,
        explain: scope => engine.traces(scope, 10),
    };
    ctx.provide('rememberYou', service);
    ctx.on('napcat/prompt', payload => {
        const raw = payload.message?.raw_message;
        if (raw?.post_type !== 'message' || raw.message_type !== 'private' || !config.owners.includes(String(raw.user_id)) || !payload.info?.adminPrivate) return;
        const text = (payload.message.message ?? []).filter(m => m.type === 'Plain').map(m => m.text ?? '').join('').trim();
        const match = /^(?:请|帮我)?(?:记住|记一下|记下|记好)[：:\s]*(.{4,500})$/u.exec(text);
        if (!match || /(?:密码|密钥|验证码|身份证|银行卡)/u.test(match[1])) return;
        const content = match[1].trim();
        const result = bridge.store.add({
            scope: 'master', kind: /喜欢|偏好|习惯/.test(content) ? 'preference' : 'fact', content, importance: 0.7,
            trust: 0.95, writer: 'user:' + raw.user_id, sourceSession: payload.info.sessionId,
            sourceUmo: payload.info.umo, ryMessageId: String(raw.message_id),
        });
        if (result.id) {
            engine.annotate(result.id, { reality: 'user_statement', confidence: 0.95 }, 'explicit-owner-message');
            bridge.afterWrite();
        }
    });
    function equip(agent) {
        if (!agent?.ctx?.tools || equipped.has(agent) || bridge.scope(String(agent.session.id)).category !== 'master') return;
        const off = agent.ctx.tools.register(defineTool({
            name: 'memory_explain',
            description: '查看本会话最近的长期记忆召回原因、分槽、确定性和字符预算；查询本身不调用模型、不修改记忆内容。',
            parameters: {},
            output: { schema: { type: 'object', additionalProperties: true }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
            async execute(_args, exec) {
                const scope = bridge.scope(String(exec.agent.session.id));
                if (scope.category !== 'master') throw new Error('仅主人会话可查看');
                return { traces: engine.traces(scope, 1) };
            },
        }));
        equipped.set(agent, off);
    }
    const equipAll = () => { for (const a of ctx.get('agents')?.list?.() ?? []) equip(a.agent ?? a); };
    ctx.on('agent/created', p => equip(p.agent ?? p));
    ctx.on('napcat/prompt', equipAll);
    ctx.on('agent/disposed', p => { const a = p.agent ?? p; equipped.get(a)?.(); equipped.delete(a); });
    equipAll();
    ctx.on('connection/request', async (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        if (!url.pathname.startsWith('/api/remember-you/')) return next();
        const endpoint = url.pathname.slice('/api/remember-you/'.length);
        const send = (status, value, html = false) => {
            res.writeHead(status, { 'content-type': html ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
            res.end(html ? value : JSON.stringify(value));
        };
        try {
            if (req.method === 'GET' && endpoint === 'ui') return send(200, page, true);
            if (req.method === 'GET' && endpoint === 'state') return send(200, { version: '0.1.0', realities: REALITIES, slots: SLOTS, memories: rows(), traces: engine.traces(master, 15), budgetChars: engine.budget });
            if (req.method !== 'POST') return send(405, { error: '只支持 POST' });
            if (!String(req.headers['content-type'] ?? '').includes('application/json')) return send(415, { error: '需要 application/json' });
            if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) return send(403, { error: 'Origin 不匹配' });
            const chunks = []; let bytes = 0;
            for await (const chunk of req) { bytes += chunk.length; if (bytes > 32768) return send(413, { error: '请求过大' }); chunks.push(chunk); }
            const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            if (endpoint === 'search') {
                const query = String(body.query ?? '').trim().slice(0, 500);
                const found = query ? await bridge.search(master, query, 5) : [];
                return send(200, { items: found.map(x => ({ id: x.memory.id, content: x.memory.content, quality: x.memory.ry })), traces: engine.traces(master, 1) });
            }
            if (endpoint === 'annotate') {
                const m = bridge.store.get(Number(body.id));
                if (!m || !visible(m, master)) return send(404, { error: '没有这条可管理的记忆' });
                engine.annotate(m.id, body.patch ?? {}, 'owner-management-page');
                return send(200, { ok: true, quality: engine.meta(m) });
            }
            return send(404, { error: 'not found' });
        } catch (error) { return send(400, { error: error.message }); }
    });
    await fs.writeFile(path.join(dir, '状态.json'), JSON.stringify({ ready: true, version: '0.1.0', at: new Date().toISOString(), memories: bridge.store.db.prepare('SELECT count(*) n FROM memories').get().n, budgetChars: engine.budget, uiPath: '/api/remember-you/ui' }, null, 2));
    ctx.effect(() => () => { restore(); for (const off of equipped.values()) off(); }, 'remember-you: restore integrations');
}
