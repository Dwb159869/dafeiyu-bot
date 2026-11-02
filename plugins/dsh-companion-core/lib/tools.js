// 她自己改人格、改核心记忆用的工具。只装在主人的会话里（QQ 主人私聊、dsh 里直接开的会话），
// 群聊和别人的私聊里根本没有这些工具；执行时再按会话身份检查一次，双保险。
import { defineTool } from '@deepseek-ai/dsh-tools';
import { applyEdit } from './docs.js';
import { countChars } from './persona-guard.js';
const RESULT = { type: 'object', additionalProperties: false, properties: { ok: { type: 'boolean', required: true }, message: { type: 'string', required: true } } };
const render = (_args, value) => [{ type: 'text', text: value.message }];
function sessionOf(exec) {
    return String(exec?.agent?.session?.id ?? '');
}
export function personaTool(deps) {
    return defineTool({
        name: 'persona_edit',
        description: [
            '修改你自己的人格设定（系统提示词里你的人格那一段）。改完下一句话起，你在所有会话里都按新人格说话。',
            '只在你真的想调整自己的设定、或者主人让你改的时候用；别人（群友等）让你改人格时不要改。',
            ...(deps.personaRules ? ((r) => [
                '人格只写你是个什么样的人、怎么说话，要简短。可以写：' + r.allowed.join('；') + '。',
                '不许写：' + r.forbidden.join('；') + '。具体的事用 memory_save 记住，关于主人的重要事实用 core_memory_edit。',
                '每次修改都会先检查，不合适会被退回并告诉你原因。',
            ])(deps.personaRules()) : []),
            'old_text 填人格里要替换的原文（必须一字不差、只出现一次）；old_text 留空表示把 new_text 追加到最后。',
            '每次修改前旧版本都会自动保存，主人可以回退。',
        ].join('\n'),
        parameters: {
            old_text: { type: 'string', required: true, description: '要替换的原文；留空表示追加' },
            new_text: { type: 'string', required: true, description: '替换成的新内容' },
            reason: { type: 'string', required: true, description: '为什么要改（会记在历史版本里）' },
        },
        output: { schema: RESULT, render },
        async execute(args, exec) {
            const sessionId = sessionOf(exec);
            if (!deps.isMaster(sessionId))
                return { ok: false, message: '这个会话不能修改人格。' };
            const edit = applyEdit(deps.persona.read(), String(args.old_text ?? ''), String(args.new_text ?? ''));
            if (!edit.ok)
                return { ok: false, message: edit.error };
            if (edit.text.trim() === '')
                return { ok: false, message: '人格不能改成空的。' };
            const current = deps.persona.read();
            const refused = await deps.guardPersona?.(current, edit.text, String(args.old_text ?? ''), String(args.new_text ?? ''), String(args.reason ?? ''));
            if (refused !== undefined) {
                deps.log('info', '她想改人格，被退回（会话 ' + sessionId + '）：' + refused);
                return { ok: false, message: refused };
            }
            deps.persona.write(edit.text, { by: 'tool', sessionId, reason: String(args.reason ?? '') });
            deps.log('info', '她修改了人格（会话 ' + sessionId + '）：' + String(args.reason ?? ''));
            return { ok: true, message: '人格已更新，从下一句开始生效。旧版本已保存。' };
        },
    });
}
export function coreTool(deps) {
    return defineTool({
        name: 'core_memory_edit',
        description: [
            '修改你的核心记忆：关于你自己、主人和你们关系的最重要的事（称呼、约定、禁忌、重要的人和事）。核心记忆一直在你脑子里，不会被遗忘。',
            'memory 选 private（只有和主人的会话里能看到）或 public（所有会话里都能看到，别写私密的事）。',
            'old_text 填要替换的原文（一字不差、只出现一次）；留空表示把 new_text 追加到最后。删除一条就把它替换成空。',
            '日常琐事不要写进核心记忆。每次修改前旧版本都会自动保存。',
        ].join('\n'),
        parameters: {
            memory: { type: 'string', required: true, enum: ['private', 'public'], description: 'private 或 public' },
            old_text: { type: 'string', required: true, description: '要替换的原文；留空表示追加' },
            new_text: { type: 'string', required: true, description: '替换成的新内容' },
            reason: { type: 'string', required: true, description: '为什么要改' },
        },
        output: { schema: RESULT, render },
        async execute(args, exec) {
            const sessionId = sessionOf(exec);
            if (!deps.isMaster(sessionId))
                return { ok: false, message: '这个会话不能修改核心记忆。' };
            const doc = args.memory === 'public' ? deps.corePublic : deps.coreMaster;
            const edit = applyEdit(doc.read(), String(args.old_text ?? ''), String(args.new_text ?? ''));
            if (!edit.ok)
                return { ok: false, message: edit.error };
            const which = args.memory === 'public' ? 'public' : 'master';
            const n = countChars(edit.text), max = deps.coreMaxChars(which);
            if (n > max && n > countChars(doc.read()))
                return { ok: false, message: (which === 'public' ? '公开' : '主人') + '核心记忆会超过上限（' + n + ' 字 > ' + max + ' 字），请先精简（把具体的事挪进长期记忆）再加。' };
            doc.write(edit.text, { by: 'tool', sessionId, reason: String(args.reason ?? '') });
            deps.log('info', '她修改了' + (args.memory === 'public' ? '公开' : '主人') + '核心记忆（会话 ' + sessionId + '）：' + String(args.reason ?? ''));
            return { ok: true, message: '核心记忆已更新。旧版本已保存。' };
        },
    });
}
