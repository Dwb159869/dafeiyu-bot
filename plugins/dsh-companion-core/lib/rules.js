// 会话分类和"例外规则"：每个会话属于 主人 / 其他私聊 / 群聊 之一，
// 默认规则按类别给，例外规则按 QQ 号或群号覆盖（不按 dsh 会话 id，因为换会话 id 就变）。
/** 本插件新增：缺少新版 bridge 权限接口时停止 QQ 存档，不能回退为默认放行。 */
export function archiveAllowed(napcat, session) {
    if (!session || !session.session_id || typeof napcat?.canArchive !== 'function')
        return false;
    try {
        return napcat.canArchive(session) === true;
    }
    catch {
        return false;
    }
}
/**
 * 判断一个 dsh 会话属于谁。
 * - 插件一登记过的 QQ 会话：主人私聊 → master，其他私聊 → private，群 → group。
 * - 插件一没登记、但 id 像 QQ 会话（napcat- 开头，比如在 dsh 网页里打开了一个 QQ 会话）：
 *   按 id 里的消息类型归到 group / private，**不当成主人**（里面是别人说的话）。
 * - 其他：dsh 里直接开的会话，只有主人能打开 dsh，算 master。
 */
export function scopeOf(sessionId, napcat) {
    const info = napcat?.sessionInfo?.(sessionId);
    if (info !== undefined) {
        const category = info.type === 'group' ? 'group' : info.adminPrivate ? 'master' : 'private';
        return { category, qq: true, umo: info.umo, ...(info.userId ? { userId: info.userId } : {}), ...(info.groupId ? { groupId: info.groupId } : {}) };
    }
    if (sessionId.startsWith('napcat-')) {
        if (/-GroupMessage-/.test(sessionId))
            return { category: 'group', qq: true };
        return { category: 'private', qq: true };
    }
    return { category: 'master', qq: false };
}
/** 这个会话命中的例外规则：群会话按群号，私聊（含主人）按对方 QQ 号。 */
export function matchRule(scope, rows) {
    const target = (r) => String(r.target ?? '').trim();
    if (scope.category === 'group' && scope.groupId)
        return rows.find(r => r.kind === 'group' && target(r) === scope.groupId);
    if (scope.userId)
        return rows.find(r => r.kind === 'user' && target(r) === scope.userId);
    return undefined;
}
const isCount = (v) => typeof v === 'number' && Number.isInteger(v) && v >= 0;
export function contextRule(scope, defaults, rows) {
    const base = defaults.context[scope.category];
    const row = matchRule(scope, rows);
    if (row === undefined)
        return { ...base };
    return {
        maxRounds: isCount(row.maxRounds) ? row.maxRounds : base.maxRounds,
        dropRounds: isCount(row.dropRounds) && row.dropRounds > 0 ? row.dropRounds : base.dropRounds,
        mode: row.mode === 'truncate' || row.mode === 'llm' ? row.mode : base.mode,
    };
}
export function archiveRule(scope, defaults, rows) {
    const base = defaults.archive[scope.category];
    const row = matchRule(scope, rows);
    if (row === undefined)
        return { ...base };
    return {
        days: isCount(row.archiveDays) && row.archiveDays > 0 ? row.archiveDays : base.days,
        unwoken: row.archiveUnwoken === 'on' ? true : row.archiveUnwoken === 'off' ? false : base.unwoken,
    };
}
/** 这个会话的遗忘方式：默认主人普通遗忘、其他直接彻底遗忘，例外规则可改。 */
export function forgetMode(scope, defaults, rows) {
    const row = matchRule(scope, rows);
    if (row?.forgetMode === 'normal' || row?.forgetMode === 'purge')
        return row.forgetMode;
    return defaults.forget[scope.category];
}
