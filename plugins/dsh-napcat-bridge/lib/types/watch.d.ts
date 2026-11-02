export type WatchState = 'ok' | 'offline' | 'disconnected' | 'unknown';
export interface WatchSettings {
    enabled: boolean;
    intervalMinutes: number;
    graceMinutes: number;
    repeatHours: number;
    alertOnRecover: boolean;
}
export interface WatchStatus {
    state: WatchState;
    /** 现在这个状态从什么时候开始 */
    since: number;
    /** 原因（NapCat 给的下线说明、接口报错等） */
    reason?: string;
    /** 小号（最近一次看到的） */
    account?: {
        userId: string;
        nickname?: string;
    };
    lastCheck?: number;
    /** 这次问题已经提醒过的时间 */
    alertedAt?: number;
    lastAlert?: {
        at: number;
        kind: 'problem' | 'recovered';
        results: string[];
    };
}
export interface WatchDeps {
    settings(): WatchSettings;
    connections(): Array<{
        selfId: string;
    }>;
    callAction(action: string, params?: Record<string, unknown>): Promise<any>;
    /** 发提醒；返回每个渠道的结果（给设置页看） */
    alert(kind: 'problem' | 'recovered', status: WatchStatus): Promise<string[]>;
    log(level: 'info' | 'warn', message: string): void;
    now?(): number;
}
export declare class Watchdog {
    private readonly deps;
    private st;
    private readonly startedAt;
    private busy;
    constructor(deps: WatchDeps);
    private now;
    status(): WatchStatus;
    /** NapCat 的下线通知 */
    onOffline(event: Record<string, unknown>): void;
    /** NapCat 的心跳 */
    onHeartbeat(event: Record<string, unknown>): void;
    /** 定时检查：自己问一次，再看要不要提醒。 */
    check(): Promise<WatchStatus>;
    private set;
    private pendingRecover;
    /** 看要不要发提醒 */
    private evaluate;
    private send;
}
