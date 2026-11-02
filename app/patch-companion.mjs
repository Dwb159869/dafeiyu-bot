import fs from 'node:fs/promises';
import path from 'node:path';
export async function patchDirectory(dir) {
    async function patch(file, pairs) {
        const p = path.join(dir, file); let text = await fs.readFile(p, 'utf8');
        for (const [old, next] of pairs) {
            if (text.includes(next)) continue;
            if (!text.includes(old)) throw new Error('宿主接口已变化，停止修改：' + file + ' / ' + old.slice(0, 60));
            text = text.replace(old, next);
        }
        await fs.writeFile(p, text);
    }
    await patch('memory.js', [[
        'const keep = existing.find(x => x.content === content || overlap(x.content, content) >= MERGE_OVERLAP);',
        'const keep = existing.find(x => this.matchMemory ? this.matchMemory(x, m, content) : (x.content === content || overlap(x.content, content) >= MERGE_OVERLAP));'
    ]]);
    await patch('index.js', [
        ['const found = recall(memories, s, query, { ...recallSettings(), topK }, vec, Date.now(), graphFor(s, query, vec));',
         'const extension = ctx.get("rememberYou");\n        const ranked = recall(memories, s, query, { ...recallSettings(), topK: extension ? Math.max(30, topK * 5) : topK }, vec, Date.now(), graphFor(s, query, vec));\n        const found = extension ? extension.select({ scope: s, query, ranked, topK, sessionId: s.sessionId }) : ranked;'],
        ["    const forgetModeOf = (s) => forgetMode(s, defaults(), rules());", '    const formatFound = found => ctx.get("rememberYou")?.format(found) ?? formatRecall(found);\n    const forgetModeOf = (s) => forgetMode(s, defaults(), rules());'],
        ["found.length > 0 ? formatRecall(found) : ''", "found.length > 0 ? formatFound(found) : ''"],
        ['const text = formatRecall(found);', 'const text = formatFound(found);'],
        ['const s0 = scope(String(agent.session.id));', 'const s0 = { ...scope(String(agent.session.id)), sessionId: String(agent.session.id) };'],
        ['        scope,\n        search: async (s, query, limit) => (await search(s, query, limit)).map(f => ({ id: f.memory.id, content: f.memory.content, scope: f.memory.scope, createdAt: f.memory.createdAt })),',
         '        scope: id => ({ ...scope(id), sessionId: id }),\n        format: found => ctx.get("rememberYou")?.format(found.map(memory => ({ memory }))),\n        search: async (s, query, limit) => (await search(s, query, limit)).map(f => ({ id: f.memory.id, content: f.memory.content, scope: f.memory.scope, createdAt: f.memory.createdAt, ry: f.memory.ry })),'],
        ["    ctx.effect(() => () => { archive?.close(); }, 'companion: archive');",
         '    if (memories) ctx.provide("companionMemory", { store: memories, scope, afterWrite, search });\n    ctx.effect(() => () => { archive?.close(); }, \'companion: archive\');'],
        // dsh 新版把预设 id 放在 session.header 上；旧写法 session.meta 恒为 undefined，导致人格和上下文管理套到所有预设
        ['    const scope = (sessionId) => scopeOf(sessionId, napcat());',
         '    const scope = (sessionId) => scopeOf(sessionId, napcat());\n    /** 预设 id：新版 dsh 存在 session.header 上，旧版在 session.meta 上 */\n    const presetOf = (session) => session?.header?.agentPreset ?? session?.meta?.agentPreset;'],
        ['excluded(agent.session?.meta?.agentPreset)', 'excluded(presetOf(agent.session))'],
        ['excluded(session?.meta?.agentPreset)', 'excluded(presetOf(session))']
    ]);
    await patch('context.js', [[
        'svc.contextPolicy(String(session.id), session.meta?.agentPreset)',
        'svc.contextPolicy(String(session.id), session?.header?.agentPreset ?? session.meta?.agentPreset)'
    ]]);
    await patch('memory-tools.js', [[
        "message: found.map(m => '#' + m.id",
        "message: deps.format?.(found) ?? found.map(m => '#' + m.id"
    ]]);
}
if (process.argv[2]) await patchDirectory(process.argv[2]);
