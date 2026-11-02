export interface DiaryEntry {
    /** 2026-10-24 或 2026-10（月度总览） */
    date: string;
    text: string;
}
export declare class DiaryStore {
    readonly dir: string;
    constructor(dir: string);
    private dayPath;
    private monthPath;
    /** 所有日记的日期，新的在前。 */
    days(): string[];
    /** 所有月度总览的月份，新的在前。 */
    months(): string[];
    readDay(date: string): string | undefined;
    readMonth(month: string): string | undefined;
    writeDay(date: string, text: string): void;
    writeMonth(month: string, text: string): void;
    deleteDay(date: string): boolean;
    deleteMonth(month: string): boolean;
    /** 最近 n 天（按日期，不一定连续）的日记，旧的在前。 */
    recentDays(n: number, before?: string): DiaryEntry[];
    /** 最近 n 个月的总览，旧的在前。 */
    recentMonths(n: number, before?: string): DiaryEntry[];
}
/** 一天按凌晨几点分界：比如分界 4 点，10 月 25 日 01:30 还算 10 月 24 日。返回 YYYY-MM-DD。 */
export declare function logicalDay(now: number, boundaryHour: number, timeZone: string): string;
/** 当地时间的 HH:MM。 */
export declare function localClock(now: number, timeZone: string): string;
/** 从文件名或正文里认出日期：2026-10-24、2026_10_24、20261024、2026年10月24日。 */
export declare function guessDate(name: string, text: string): string | undefined;
export declare function diaryPrompt(date: string, chat: readonly string[], memories: readonly string[], recent: readonly DiaryEntry[]): string;
export declare function monthPrompt(month: string, days: readonly DiaryEntry[]): string;
/**
 * 开新会话时给她看的那一段：月度总览 + 最近的日记 + 上一个会话最后的内容。
 * 超过预算（字数）时，先把最早几天的日记缩成开头一段，还不够就去掉最早的。
 */
export declare function diaryBlock(months: readonly DiaryEntry[], days: readonly DiaryEntry[], carry: string, budgetChars: number): string;
