import type { Archive } from './archive.js';
import type { Organizer } from './organizer.js';
import type { Category, Scope } from './rules.js';
export interface ProactiveSettings {
    enabled: boolean;
    /** 主人私聊的间隔范围（分钟） */
    masterMinMinutes: number;
    masterMaxMinutes: number;
    /** 其他私聊和群聊的间隔范围（分钟） */
    othersMinMinutes: number;
    othersMaxMinutes: number;
    privateEnabled: boolean;
    groupEnabled: boolean;
    /** 免打扰 HH:MM–HH:MM（可以跨午夜） */
    quietStart: string;
    quietEnd: string;
    /** 她这么多分钟内在这个会话里说过话就不触发 */
    recentMinutes: number;
    /** 群聊带几条上下文（里面的图片不限张数） */
    groupContextMessages: number;
    /** 其他人：最近几天里聊过才主动找 */
    activeWithinDays: number;
    silenceToken: string;
    timeZone: string;
    /** 例外规则里这个会话是开（true）、关（false）还是用默认（undefined） */
    override(scope: Scope): boolean | undefined;
}
export interface ProactiveDeps {
    archive: Archive;
    organizer: Organizer;
    settings(): ProactiveSettings;
    wake(): ((umo: string, content: unknown[]) => Promise<unknown>) | undefined;
    meta: {
        get(key: string): string | undefined;
        set(key: string, value: string): void;
    };
    mediaDir: string;
    log(level: 'debug' | 'info' | 'warn', message: string): void;
    random?: () => number;
}
/** 现在是不是免打扰时间。 */
export declare function inQuiet(clock: string, start: string, end: string): boolean;
/** 下一次间隔（毫秒）：主人和其他人各自在自己的范围里均匀随机。 */
export declare function nextDelay(category: Category, s: Pick<ProactiveSettings, 'masterMinMinutes' | 'masterMaxMinutes' | 'othersMinMinutes' | 'othersMaxMinutes'>, random?: () => number): number;
/** 唤醒她时说的话。 */
export declare function proactivePrompt(category: Category, now: number, lastTime: number | undefined, s: Pick<ProactiveSettings, 'silenceToken' | 'timeZone'>, groupLines?: readonly string[]): string;
export interface ProactiveEntry {
    umo: string;
    category: Category;
    next?: number;
    last?: number;
    lastResult?: string;
}
export declare class Proactive {
    private readonly deps;
    private busy;
    private readonly random;
    constructor(deps: ProactiveDeps);
    private scopeOf;
    /** 这个会话要不要主动找。 */
    private eligible;
    private schedule;
    /** 每分钟调一次。返回这次唤醒了哪些会话。 */
    tick(now?: number): Promise<string[]>;
    /** 唤醒一次（设置页「试一次」也用它）。 */
    fire(umo: string, scope: Scope, now?: number): Promise<boolean>;
    /** 设置页显示：每个会话下次什么时候、上次什么时候。 */
    list(now?: number): ProactiveEntry[];
    /** 找某个会话的类别（设置页「试一次」用）。 */
    scopeForUmo(umo: string): Scope | undefined;
}
