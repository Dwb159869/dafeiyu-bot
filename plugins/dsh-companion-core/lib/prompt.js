// 把人格和核心记忆放进系统提示词。
// 挂在 dsh 全局的 system-prompt/assemble 组装环节上：每个会话每一步发给模型前都会经过这里，
// 所以人格文件一改，所有会话（包括正在聊的）下一步就是新人格，不用重启也不用重开会话。
//
// 注意：预设里如果有 dsh-persona 且开了 complete: true，dsh 会在组装之后把那段人格原样恢复，
// 这里替换不了——这种预设要加进「不生效的预设」，或者把 complete 关掉（设置页有说明）。
/** dsh-system-prompt 的段名（PERSONA_PREFIX_SECTION / 内置身份句）。 */
export const PERSONA_SECTION = 'deployment:persona-prefix';
export const IDENTITY_SECTION = 'harness:identity';
export const CORE_SECTION = 'companion:core-memory';
/** 核心记忆前后加个说明，让她知道这是她自己一直记得的事。 */
export function coreBlock(core) {
    return '<core_memory>\n以下是你一直记得的核心记忆（关于你自己、主人和你们的关系），它们始终有效：\n\n' + core.trim() + '\n</core_memory>';
}
/** 改一次组装结果：换人格、加核心记忆。人格和核心记忆都为空时原样返回。 */
export function applyPrompt(assembly, parts) {
    const persona = parts.persona.trim();
    const core = parts.core.trim();
    if (persona === '' && core === '')
        return assembly;
    let sections = [...assembly.sections];
    if (persona !== '') {
        if (parts.personaOnly)
            sections = sections.filter(s => s.name !== IDENTITY_SECTION);
        // 人格里可能出现 {{ }}，不做变量替换（否则 dsh 会当成变量报错）
        const ours = { name: PERSONA_SECTION, text: persona, interpolate: false };
        const at = sections.findIndex(s => s.name === PERSONA_SECTION);
        if (at >= 0)
            sections[at] = ours;
        else
            sections.unshift(ours);
    }
    sections = sections.filter(s => s.name !== CORE_SECTION);
    if (core !== '') {
        const at = sections.findIndex(s => s.name === PERSONA_SECTION);
        sections.splice(at >= 0 ? at + 1 : 0, 0, { name: CORE_SECTION, text: coreBlock(core), interpolate: false });
    }
    return { ...assembly, sections };
}
