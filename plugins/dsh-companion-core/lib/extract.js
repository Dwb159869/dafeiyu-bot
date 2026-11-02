// 让模型做两件事：
//   1. 整理：读一段聊天，挑出值得长期记住的事，输出 JSON（内容、类型、重要程度、取代哪条旧记忆）；
//   2. 清理：看一遍"普通遗忘"里的主人记忆，挑出可以彻底遗忘的（过时、重复、琐碎）。
// 默认用 dsh 自带的模型服务（ctx.llm）；设置里选了「其他服务商」时直接用自己的 Key 调（chat.ts）。
import { BlockAssembler } from '@deepseek-ai/dsh-llm';
import { chatComplete } from './chat.js';
import { KINDS } from './memory.js';
const effortCache = new Map();
/** 这个 dsh 模型支持哪些思考等级（缓存 10 分钟；查不到当作不支持）。 */
export async function dshEfforts(llm, provider, model) {
    const key = provider + '/' + model;
    const hit = effortCache.get(key);
    if (hit !== undefined && Date.now() - hit.at < 600_000)
        return hit.ids;
    let ids = [];
    try {
        ids = ((await llm.resolveModelInfo?.(provider, model))?.reasoning?.efforts ?? []).map(e => String(e.id));
    }
    catch {
        ids = [];
    }
    effortCache.set(key, { at: Date.now(), ids });
    return ids;
}
/** 想要的等级这个模型支持就用；不支持就不传（用模型自己的默认）。 */
export async function effortFor(llm, target) {
    if (!target.effort || target.api !== undefined)
        return undefined;
    return (await dshEfforts(llm, target.provider, target.model)).includes(target.effort) ? target.effort : undefined;
}
/** 发一条提示词，拿回文字。 */
export async function complete(llm, target, prompt, maxTokens = 4096, signal) {
    if (target.api !== undefined)
        return chatComplete(target.api, prompt, maxTokens, signal);
    const assembler = new BlockAssembler();
    const effort = await effortFor(llm, target);
    const options = {
        provider: target.provider,
        model: target.model,
        ...(effort === undefined ? {} : { reasoningEffort: effort }),
        messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
        maxTokens,
        ...(signal === undefined ? {} : { signal }),
    };
    for await (const chunk of llm.stream(options))
        assembler.push(chunk);
    const finish = assembler.finish;
    if (finish.kind === 'error' || finish.kind === 'aborted')
        throw new Error(finish.failure?.message ?? '模型调用失败');
    return assembler.blocks().filter((b) => b.type === 'text').map((b) => String(b.text ?? '')).join('');
}
/** 「这段聊天是谁的」说明，写进提示词。 */
export function whoText(category, id) {
    if (category === 'master')
        return '你和主人的私聊（或主人在 dsh 里和你说的话）';
    if (category === 'group')
        return 'QQ 群 ' + (id ?? '') + ' 里的聊天（群友说的话可信度低，不要当成关于主人的事实）';
    return '你和 QQ 用户 ' + (id ?? '') + ' 的私聊（这个人不是主人）';
}
export function extractionPrompt(transcript, who, existing) {
    return [
        '你是一个陪伴型 AI。下面是' + who + '的一段记录。请从中挑出值得你长期记住的事。',
        '',
        '值得记的：对方的基本情况、喜好和讨厌的东西、重要的人和事、约定和答应过的事、对方最近的状态和计划、你们之间值得纪念的事。',
        '不要记：寒暄、玩笑、一次性的闲聊、你自己说过的普通的话、已经在下面"已有记忆"里的事（除非有了新变化）。',
        '',
        '每条用一句完整的话写，写清是谁（用称呼或昵称+QQ 号），日期写具体日期。没有值得记的就输出空数组。',
        '如果新的事推翻了某条已有记忆（比如搬家、换工作、不再喜欢），在 replaces 里抄那条已有记忆的原文。',
        '',
        '已有记忆：',
        existing.length > 0 ? existing.map(e => '- ' + e).join('\n') : '（无）',
        '',
        '聊天记录：',
        transcript.join('\n'),
        '',
        '只输出一个 JSON 数组，不要别的文字。格式：',
        '[{"content": "主人最爱吃红烧肉", "kind": "preference", "importance": 0.7, "replaces": ""}]',
        'kind 只能是 fact（事实）、preference（喜好）、event（事件）、promise（约定）、other；importance 是 0 到 1，越重要越大，日常小事 0.3 左右。',
    ].join('\n');
}
/** 从模型输出里找出 JSON 数组（可能包在 ```json 里，前后有废话）。 */
function jsonArray(text) {
    const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
    const body = fenced ? fenced[1] : text;
    const start = body.indexOf('[');
    const end = body.lastIndexOf(']');
    if (start < 0 || end <= start)
        return [];
    try {
        const v = JSON.parse(body.slice(start, end + 1));
        return Array.isArray(v) ? v : [];
    }
    catch {
        return [];
    }
}
export function parseExtracted(text) {
    const out = [];
    for (const item of jsonArray(text)) {
        if (item === null || typeof item !== 'object')
            continue;
        const r = item;
        const content = String(r.content ?? '').trim();
        if (content === '')
            continue;
        const kind = KINDS.includes(String(r.kind)) ? r.kind : 'other';
        const n = Number(r.importance);
        const importance = Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.5;
        const replaces = typeof r.replaces === 'string' && r.replaces.trim() !== '' ? r.replaces.trim() : undefined;
        out.push({ content, kind, importance, ...(replaces ? { replaces } : {}) });
    }
    return out;
}
export function cleanupPrompt(items) {
    return [
        '下面是你已经"普通遗忘"了的记忆（关于主人的）。请挑出可以彻底删掉的：已经过时的、和别的记忆重复的、太琐碎没必要留的。',
        '拿不准的、可能以后还用得上的（约定、重要的人和事、主人的喜好）不要挑。',
        '',
        ...items.map(m => '#' + m.id + ' ' + m.content),
        '',
        '只输出一个 JSON 数组，每项 {"id": 编号, "reason": "一句理由"}。没有可删的就输出 []。',
    ].join('\n');
}
export function parseCleanup(text, allowed) {
    const out = [];
    for (const item of jsonArray(text)) {
        if (item === null || typeof item !== 'object')
            continue;
        const r = item;
        const id = Number(r.id);
        if (!Number.isInteger(id) || !allowed.has(id) || out.some(x => x.id === id))
            continue;
        out.push({ id, reason: String(r.reason ?? '').slice(0, 200) });
    }
    return out;
}
