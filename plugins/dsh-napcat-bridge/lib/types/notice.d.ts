import type { OneBotEvent } from './onebot/event.js';
export interface NoticeNames {
    /** event.user_id 的名字 */
    user: string;
    /** operator_id 的名字（没有时为空） */
    operator: string;
    /** target_id 的名字（没有时为空） */
    target: string;
    /** 被撤回消息的文字（查得到时） */
    recalled?: string;
}
export declare function describeNotice(event: OneBotEvent, n: NoticeNames, selfId: string): string;
export declare function describeRequest(event: OneBotEvent, n: NoticeNames): string;
