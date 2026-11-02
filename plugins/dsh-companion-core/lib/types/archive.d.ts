import { DatabaseSync } from 'node:sqlite';
/** 数据结构版本；以后改表结构时加升级步骤，不丢旧数据。 */
export declare const SCHEMA_VERSION = 5;
export interface ArchivedMessage {
    /** unified_msg_origin */
    umo: string;
    kind: 'private' | 'group';
    userId?: string;
    groupId?: string;
    /** QQ 消息 id（她发出的没有） */
    messageId?: string;
    /** 毫秒，UTC */
    time: number;
    direction: 'in' | 'out';
    senderId: string;
    senderName: string;
    /** 有没有唤醒她（交给模型） */
    woke: boolean;
    /** message：消息；notice：通知/请求（text 是中文描述） */
    type: 'message' | 'notice';
    text: string;
    /** 原始消息段（JSON，截断到 32KB） */
    segments?: string;
    /** 当时对应的 dsh 会话 */
    sessionId?: string;
}
export interface ArchiveStats {
    total: number;
    byKind: Record<string, number>;
    oldest?: number;
    newest?: number;
}
export declare class Archive {
    readonly path: string;
    /** 同一个数据库文件里还有记忆表（memory.ts 共用这个连接） */
    readonly db: DatabaseSync;
    constructor(path: string);
    private migrate;
    /** 存一条；同一会话同一 QQ 消息 id 只存一次。返回是否新存了。 */
    add(m: ArchivedMessage): boolean;
    /** 某个会话最近的几条（新的在后）。 */
    recent(umo: string, limit: number, before?: number): ArchivedMessage[];
    /** 某个会话 id 大于 afterId 的消息（按时间顺序），用来整理「还没整理过的部分」。返回带存档 id。 */
    since(umo: string, afterId: number, limit?: number): Array<ArchivedMessage & {
        id: number;
    }>;
    /** 有消息的会话（umo）和各自最大的存档 id。 */
    umos(): Array<{
        umo: string;
        maxId: number;
        kind: string;
    }>;
    /** 这条消息之前，会话里最近的 limit 条（收到的和她发出的都算，按存进来的先后，不按时间：QQ 消息时间只精确到秒）。 */
    lastMessages(umo: string, limit: number, excludeMessageId?: string): ArchivedMessage[];
    /** 她在某个会话里最后一次说话的时间。 */
    lastOutTime(umo: string): number | undefined;
    /** 某个会话最后一条（收到或发出）的时间。 */
    lastTime(umo: string): number | undefined;
    /** 某个会话最早一条的时间。 */
    oldest(umo: string): number | undefined;
    /** 删掉某个会话 cutoff 之前的存档，返回删了几条。 */
    deleteBefore(umo: string, cutoff: number): number;
    /** 这个 QQ 会话现在对应的 dsh 会话（存档里最近一条带会话 id 的），以及这个 dsh 会话最早一条消息的时间。 */
    currentSession(umo: string): {
        sessionId: string;
        firstTime: number;
        lastTime: number;
    } | undefined;
    /** 一段时间里几个会话的消息（写日记用），按时间顺序。 */
    between(umos: readonly string[], from: number, to: number): ArchivedMessage[];
    /** 补上收到消息后才下载好的图片等（改那条的消息段）。 */
    updateSegments(umo: string, messageId: string, segments: string): void;
    /** 存档里还引用着的本地图片文件名。 */
    mediaRefs(): Set<string>;
    retire(r: {
        sessionId: string;
        umo: string;
        category: string;
        lastTime: number;
        state: string;
        note?: string;
    }): void;
    isRetired(sessionId: string): boolean;
    retiredList(): Array<{
        sessionId: string;
        umo: string;
        category: string;
        retiredAt: number;
        lastTime: number;
        state: string;
        note?: string;
    }>;
    addJournal(sessionId: string, role: 'master' | 'self', text: string, time?: number): number;
    journalSince(sessionId: string, afterId: number, limit?: number): Array<{
        id: number;
        time: number;
        role: string;
        text: string;
    }>;
    journalBetween(from: number, to: number): Array<{
        sessionId: string;
        time: number;
        role: string;
        text: string;
    }>;
    journalSessions(): Array<{
        sessionId: string;
        maxId: number;
    }>;
    deleteJournalBefore(cutoff: number): number;
    /** 「已整理到哪条」之类的小计数。 */
    cursor(key: string): number;
    setCursor(key: string, value: number): void;
    stats(): ArchiveStats;
    close(): void;
}
