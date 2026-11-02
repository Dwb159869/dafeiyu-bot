export function qqOwner(info, owners) {
    const p = String(info?.umo ?? '').split(':');
    return p.length === 3 && p[1] === 'FriendMessage' && owners.includes(p[2]) ? p[2] : undefined;
}
export function recurringBatch(message) {
    if (message?.source?.kind !== 'schedule') return undefined;
    const text = message.content?.filter(b => b.type === 'text').map(b => b.text ?? '').join('\n') ?? '';
    if (!text.startsWith('[SCHEDULE REMINDER BATCH]\n')) return undefined;
    try {
        const parsed = JSON.parse(text.split('\n').find(l => l.startsWith('reminders_json: '))?.slice(16));
        return Array.isArray(parsed) && parsed.every(x => typeof x.schedule_id === 'string') ? parsed : undefined;
    } catch { return undefined; }
}
export function withBatch(message, batch) {
    return { ...message, content: [{ type: 'text', text: '[SCHEDULE REMINDER BATCH]\nThis is a scheduled message from the user\nreminders_json: ' + JSON.stringify(batch) }] };
}
// Coalesce only structured recurring reminders. Human messages and one-shot reminders are retained.
export function coalesceRecurring(agent, input, activeIds = new Set()) {
    const incoming = recurringBatch(input);
    if (!incoming) return { message: input, removed: 0, skipped: [] };
    const skipped = incoming.filter(x => activeIds.has(x.schedule_id)).map(x => x.schedule_id);
    const keep = incoming.filter(x => !activeIds.has(x.schedule_id));
    if (!keep.length) return { removed: 0, skipped };
    const newer = new Set(keep.map(x => x.schedule_id));
    let removed = 0;
    for (const previous of [...agent.inbox.nextStep, ...agent.inbox.nextTurn]) {
        const batch = recurringBatch(previous);
        if (!batch) continue;
        const rest = batch.filter(x => !newer.has(x.schedule_id));
        removed += batch.length - rest.length;
        if (rest.length === batch.length) continue;
        if (!rest.length) agent.inbox.remove(previous.id);
        else agent.inbox.replace(previous.id, withBatch(previous, rest));
    }
    return { message: withBatch(input, keep), removed, skipped };
}
export function qqQuestionResult(fullAccess = false) {
    const permission = fullAccess ? '主人已授予完全权限，明确的操作直接执行；' : '按当前会话权限处理；';
    const message = 'QQ 会话不使用界面问答或审批等待。' + permission + '仅缺少必要目标信息时，用普通 QQ 回复提问并结束本轮，下一条消息再继续。本结果不是主人回答，也不是新增授权。';
    return { isError: true, error: { message }, content: [{ type: 'text', text: message }] };
}
