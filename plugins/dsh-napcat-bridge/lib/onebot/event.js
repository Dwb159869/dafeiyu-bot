// 移植自 aiocqhttp/event.py（MIT）。
/**
 * aiocqhttp.Event.from_payload：必须能取到 post_type 和 detail_type，否则返回 null。
 * detail_type = payload[f'{post_type}_type']。
 */
export function eventFromPayload(payload) {
    const postType = payload.post_type;
    if (postType === undefined)
        return null;
    if (payload[postType + '_type'] === undefined)
        return null;
    return payload;
}
/** aiocqhttp.Event.name：有 sub_type 时为 {type}.{detail_type}.{sub_type}。 */
export function eventName(event) {
    const type = event.post_type;
    const detail = event[type + '_type'];
    const sub = event.sub_type;
    return sub ? type + '.' + detail + '.' + sub : type + '.' + detail;
}
