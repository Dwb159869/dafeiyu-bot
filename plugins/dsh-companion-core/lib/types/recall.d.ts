import { type Memory, type MemoryStore } from './memory.js';
import type { Scope } from './rules.js';
export interface RecallSettings {
    topK: number;
    /** 只用关键词时，相关度低于这个不要 */
    keywordThreshold: number;
    /** 用了向量时，综合相关度低于这个不要 */
    vectorThreshold: number;
    /** 用了向量时关键词占多少（0–1），其余是向量 */
    keywordWeight: number;
    importanceWeight: number;
    recencyWeight: number;
    /** 主人会话里群记忆的折扣 */
    groupDiscount: number;
    /** 重要程度、新近程度的半衰期（天） */
    halfLifeDays: number;
}
export interface Recalled {
    memory: Memory;
    relevance: number;
    score: number;
}
/** 重要程度随"多久没被想起"衰减。 */
export declare function effectiveImportance(m: Memory, halfLifeDays: number, now: number): number;
export declare function recall(store: MemoryStore, scope: Scope, query: string, s: RecallSettings, vector?: {
    query: Float32Array;
    model: string;
}, now?: number, graph?: ReadonlyMap<number, number>): Recalled[];
/** 放进这一轮消息里的那段文字。 */
export declare function formatRecall(items: readonly Recalled[]): string;
