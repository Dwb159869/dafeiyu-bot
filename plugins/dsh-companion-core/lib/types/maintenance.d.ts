import type { Archive } from './archive.js';
import { type DiaryStore } from './diary.js';
import { type LlmLike, type ModelTarget } from './extract.js';
import type { MemoryStore } from './memory.js';
import type { Organizer } from './organizer.js';
import type { Scope } from './rules.js';
export interface MaintenanceSettings {
    diaryEnabled: boolean;
    monthlyEnabled: boolean;
    boundaryHour: number;
    timeZone: string;
    rotateSessions: boolean;
    deleteOldSessions: boolean;
    /** 换会话时带过去最近几条消息 */
    carryMessages: number;
    /** 这个会话的存档保留天数 */
    archiveDays(scope: Scope): number;
}
export interface NapcatRotate {
    rotateSession?(umo: string): Promise<{
        oldSessionId: string;
        newSessionId: string;
    }>;
}
export interface WorkspaceRegistryLike {
    archiveSession?(id: string, options?: {
        stopActivity?: boolean;
    }): Promise<void>;
    unarchiveSession?(id: string): Promise<void>;
    list?(): Array<{
        sessionIds: readonly string[];
        detachSession?(id: string): Promise<void>;
    }>;
}
export interface PersistenceLike {
    stat(id: string): Promise<unknown>;
    list?(): Promise<unknown[]>;
}
export interface MaintenanceDeps {
    archive: Archive;
    store: MemoryStore;
    diary: DiaryStore;
    organizer: Organizer;
    llm(): LlmLike | undefined;
    target(): ModelTarget | undefined;
    settings(): MaintenanceSettings;
    napcat(): NapcatRotate | undefined;
    registry(): WorkspaceRegistryLike | undefined;
    persistence(): PersistenceLike | undefined;
    /** 这个 dsh 会话还在跑吗（在跑的不能删） */
    isLive(sessionId: string): boolean;
    /** <DSH_HOME>/sessions */
    sessionsRoot: string;
    /** 图片目录 */
    mediaDir: string;
    /** 换会话时带过去的内容存起来，新会话第一轮给她 */
    setCarry(umo: string, text: string): void;
    log(level: 'debug' | 'info' | 'warn', message: string): void;
}
export interface MaintenanceReport {
    at: number;
    diary?: {
        date: string;
        written: boolean;
        month?: string;
        error?: string;
    };
    expired: Array<{
        umo: string;
        deleted: number;
        rotated?: string;
        error?: string;
    }>;
    deletedSessions: string[];
    failedSessions: Array<{
        sessionId: string;
        error: string;
    }>;
    mediaRemoved: number;
}
export declare class Maintenance {
    private readonly deps;
    private running;
    last: MaintenanceReport | undefined;
    constructor(deps: MaintenanceDeps);
    /** 跑一遍（同时只跑一个）。 */
    run(now?: number, what?: 'all' | 'diary' | 'expire'): Promise<MaintenanceReport>;
    private doRun;
    /** 主人的 QQ 会话（存档里记着类别是主人的）。 */
    private masterUmos;
    writeDiary(now: number): Promise<NonNullable<MaintenanceReport['diary']>>;
    private expire;
    private archiveSession;
    /**
     * 删一个已归档的旧会话（dsh 没有删除接口，这是我们自己的做法，端到端测试验证过）：
     * 确认不在跑 → 从工作区移除 → 删掉会话文件夹 → 从归档列表去掉 → 确认 dsh 查不到它了、列表还正常。
     * 只删插件一建的 QQ 会话（id 以 napcat- 开头），文件夹必须在 <DSH_HOME>/sessions 里。
     */
    deleteSession(id: string): Promise<void>;
    /** 删掉没被存档引用的图片，返回删了几个。 */
    private gcMedia;
}
