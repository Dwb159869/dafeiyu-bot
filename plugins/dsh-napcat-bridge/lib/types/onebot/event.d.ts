/** OneBot 原始事件（aiocqhttp.Event 是 dict 子类，这里直接用普通对象）。 */
export type OneBotEvent = Record<string, any>;
/**
 * aiocqhttp.Event.from_payload：必须能取到 post_type 和 detail_type，否则返回 null。
 * detail_type = payload[f'{post_type}_type']。
 */
export declare function eventFromPayload(payload: Record<string, any>): OneBotEvent | null;
/** aiocqhttp.Event.name：有 sub_type 时为 {type}.{detail_type}.{sub_type}。 */
export declare function eventName(event: OneBotEvent): string;
