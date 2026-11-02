import type { DatabaseSync } from 'node:sqlite';
import { type LlmLike, type ModelTarget } from './extract.js';
import type { Memory, MemoryStore } from './memory.js';
import type { ForgetMode } from './rules.js';
export interface CareSettings {
    cleanupEnabled: boolean;
    cleanupDays: number;
    cleanupImportance: number;
    purgeForgottenEnabled: boolean;
    purgeForgottenDays: number;
    consolidateEnabled: boolean;
    /** 相似到多少算"相近"（按词的重合，0–1） */
    consolidateOverlap: number;
    /** 一次最多整合几组 */
    consolidateGroups: number;
    halfLifeDays: number;
    /** 某个归属的遗忘方式 */
    forgetMode(scope: string): ForgetMode;
}
export interface CareDeps {
    db: DatabaseSync;
    store: MemoryStore;
    llm(): LlmLike | undefined;
    target(): ModelTarget | undefined;
    settings(): CareSettings;
    log(level: 'info' | 'warn', message: string): void;
}
export interface CleanupReport {
    forgotten: number;
    purged: number;
}
export interface ConsolidateReport {
    groups: number;
    merged: number;
    created: number;
    purgedOld: number;
}
export declare function mergePrompt(items: readonly Memory[]): string;
/** 按内容相近程度分组（同一归属、正常状态、不含日记）；每组 2～8 条。 */
export declare function similarGroups(items: readonly Memory[], threshold: number, maxGroups: number): Memory[][];
export declare class Care {
    private readonly deps;
    constructor(deps: CareDeps);
    /** 自动清理。 */
    cleanup(now?: number): CleanupReport;
    /** 定期整合。 */
    consolidate(now?: number): Promise<ConsolidateReport>;
    /** 最近一次整合（同一次运行里的所有组），可以撤销的。 */
    lastRun(): {
        at: number;
        groups: Array<{
            scope: string;
            old: Memory[];
            created: Memory[];
        }>;
    } | undefined;
    /** 撤销最近一次整合：删掉合成出来的，旧的恢复。 */
    undoLast(): number;
}
