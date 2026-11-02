// 主动记忆：给每个会话装上「回忆」「记住」「遗忘」三个工具（设置里能关）。
// 每个会话只能搜到、记到、忘掉自己能看到的那部分记忆（归属见 memory.ts）；群里和别人私聊里记的可信度低。
import { defineTool } from '@deepseek-ai/dsh-tools';
import { KINDS, defaultTrust, ownScope, visibleScopes } from './memory.js';
const RESULT = { type: 'object', additionalProperties: false, properties: { ok: { type: 'boolean', required: true }, message: { type: 'string', required: true } } };
const render = (_args, value) => [{ type: 'text', text: value.message }];
const sessionOf = (exec) => String(exec?.agent?.session?.id ?? '');
function day(ms) {
    return new Date(ms).toISOString().slice(0, 10);
}
export function searchTool(deps) {
    return defineTool({
        name: 'memory_search',
        description: '回忆：在你的长期记忆里搜和某件事有关的内容。觉得自己应该记得、但一时想不起来时用。只能搜到在这个聊天里能想起来的记忆。',
        parameters: {
            query: { type: 'string', required: true, description: '想回忆的事（几个关键词或一句话）' },
        },
        output: { schema: RESULT, render },
        async execute(args, exec) {
            const scope = deps.scope(sessionOf(exec));
            const found = await deps.search(scope, String(args.query ?? ''), 10);
            if (found.length === 0)
                return { ok: true, message: '没有想起相关的记忆。' };
            return { ok: true, message: found.map(m => '#' + m.id + '（' + day(m.createdAt) + (m.scope.startsWith('group:') ? '，群 ' + m.scope.slice(6) : '') + '）' + m.content).join('\n') };
        },
    });
}
export function saveTool(deps) {
    return defineTool({
        name: 'memory_save',
        description: [
            '记住：把一件值得长期记住的事写进你的长期记忆（对方的喜好、重要的事、约定、近况等）。日常闲聊不用记。',
            '一句话写清是谁、什么事；如果这件事推翻了以前的某条记忆，把旧记忆的原文填进 replaces。',
            '在群里或别人的私聊里记的事只在那个群/那个人那里想得起来。',
        ].join('\n'),
        parameters: {
            content: { type: 'string', required: true, description: '要记住的事，一句完整的话' },
            kind: { type: 'string', enum: [...KINDS], description: 'fact 事实、preference 喜好、event 事件、promise 约定、other' },
            importance: { type: 'number', description: '重要程度 0–1，日常小事 0.3，很重要 0.8 以上' },
            replaces: { type: 'string', description: '被这条推翻的旧记忆原文（没有就不填）' },
            public: { type: 'boolean', description: '只在和主人的会话里有用：记成所有聊天都能想起来的公开记忆（别写私密的事）' },
        },
        output: { schema: RESULT, render },
        async execute(args, exec) {
            const sessionId = sessionOf(exec);
            const scope = deps.scope(sessionId);
            const target = scope.category === 'master' && args.public === true ? 'public' : ownScope(scope);
            const r = deps.store.add({
                scope: target, kind: KINDS.includes(String(args.kind)) ? args.kind : 'other',
                content: String(args.content ?? ''), importance: typeof args.importance === 'number' ? args.importance : 0.5,
                trust: defaultTrust(scope.category, 'self'), writer: 'self', sourceSession: sessionId,
                ...(scope.umo ? { sourceUmo: scope.umo } : {}),
                ...(typeof args.replaces === 'string' && args.replaces.trim() !== '' ? { replaces: args.replaces } : {}),
            });
            if (r.action === 'empty')
                return { ok: false, message: '内容是空的。' };
            if (r.action === 'blocked')
                return { ok: false, message: '这件事以前被彻底遗忘过，不再记。' };
            deps.afterWrite();
            deps.log('info', '她记住了一条（会话 ' + sessionId + '，' + target + '）');
            return { ok: true, message: r.action === 'merged' ? '这件事已经记得了（#' + r.id + '），加深了印象。' : '记住了（#' + r.id + '）。' + ('superseded' in r && r.superseded ? '旧的 #' + r.superseded + ' 不再当真。' : '') };
        },
    });
}
export function forgetTool(deps) {
    return defineTool({
        name: 'memory_forget',
        description: '遗忘：忘掉一条长期记忆（比如对方说"别记这个了"、或者它已经不对了）。用「回忆」查到的编号。只能忘掉这个聊天里能想起来的、属于这个聊天的记忆。',
        parameters: {
            id: { type: 'integer', required: true, description: '记忆编号（#后面的数字）' },
            reason: { type: 'string', description: '为什么要忘' },
        },
        output: { schema: RESULT, render },
        async execute(args, exec) {
            const sessionId = sessionOf(exec);
            const scope = deps.scope(sessionId);
            const m = deps.store.get(Number(args.id));
            const allowed = scope.category === 'master' ? ['master', 'public'] : [ownScope(scope)];
            if (m === undefined || !allowed.includes(m.scope) || !visibleScopes(scope).scopes.includes(m.scope))
                return { ok: false, message: '没有这条记忆，或者它不属于这个聊天。' };
            const mode = deps.forgetMode(scope);
            if (mode === 'purge')
                deps.store.purge(m.id);
            else
                deps.store.forget(m.id);
            deps.log('info', '她' + (mode === 'purge' ? '彻底' : '') + '忘掉了 #' + m.id + '（会话 ' + sessionId + '）' + (args.reason ? '：' + String(args.reason) : ''));
            return { ok: true, message: '已经忘掉了。' };
        },
    });
}
