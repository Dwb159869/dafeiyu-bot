export interface PaceSettings {
    typingPrivate: boolean;
    typingGroup: boolean;
    /** 每分钟打几个字 */
    charsPerMinute: number;
    typingMinSeconds: number;
    typingMaxSeconds: number;
    /** 同一个群两条之间至少隔几秒（0 = 不限） */
    groupMinGapSeconds: number;
    /** 一段时间里最多发几条（0 = 不限） */
    groupMaxPerWindow: number;
    groupWindowSeconds: number;
    /** 为了守频率最多等几秒，超过就不发了 */
    maxWaitSeconds: number;
}
export interface PacerDeps {
    settings(): PaceSettings;
    log(level: 'debug' | 'info' | 'warn', message: string): void;
    now?: () => number;
    sleep?: (ms: number) => Promise<void>;
}
/** 按打字速度要等多久（毫秒）。 */
export declare function typingDelay(text: string, isGroup: boolean, s: PaceSettings): number;
/**
 * 分段发送时每段的打字时间：每段按自己的字数和打字速度算（有最短），但每段最多等 maxSegmentSeconds，
 * 免得一行十几个字就等十秒、八行等一分钟。
 */
export declare function splitTyping(segments: readonly string[], isGroup: boolean, s: PaceSettings, maxSegmentSeconds: number): number[];
/** 为了守群里的发言频率还要等多久（毫秒）；sent 是这个群最近发出的时间（从早到晚）。 */
export declare function rateDelay(sent: readonly number[], now: number, s: PaceSettings): number;
export declare class Pacer {
    private readonly deps;
    private queues;
    private sent;
    private readonly now;
    private readonly sleep;
    constructor(deps: PacerDeps);
    /**
     * 排进这个会话的队列，等打字、守频率，然后发。返回发了没有。
     * typingMs：分段发送时由调用方给出这一段分到的打字时间（整条回复算一次，按长度分给各段）。
     */
    run(umo: string, isGroup: boolean, text: string, send: () => Promise<void | boolean>, typingMs?: number, bypassRateLimit?: boolean): Promise<'sent' | 'dropped'>;
    private one;
}
