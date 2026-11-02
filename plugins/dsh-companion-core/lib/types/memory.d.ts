import type { DatabaseSync } from 'node:sqlite';
import type { Category, Scope } from './rules.js';
import { type KeywordIndex } from './text.js';
/** diary：日记和月度总览（她自己写的，只有整理任务会写这一类） */
export type MemoryKind = 'fact' | 'preference' | 'event' | 'promise' | 'other' | 'diary';
export declare const KINDS: readonly MemoryKind[];
export interface Memory {
    id: number;
    scope: string;
    kind: MemoryKind;
    content: string;
    importance: number;
    /** 可信度：主人说的、她自己总结主人会话的高，群友说的低 */
    trust: number;
    /** self（她用工具记的）、organize（整理任务）、settings（设置页）、import（导入） */
    writer: string;
    sourceUmo?: string;
    sourceSession?: string;
    /** 来源那段聊天的时间范围（毫秒，UTC） */
    sourceFrom?: number;
    sourceTo?: number;
    createdAt: number;
    /** 写入时的时区（显示用） */
    tz: string;
    lastRecalled?: number;
    recallCount: number;
    status: 'active' | 'forgotten';
    forgottenAt?: number;
    /** 被哪条新记忆取代（取代后不再被想起，但原文保留） */
    supersededBy?: number;
    embedModel?: string;
}
export interface NewMemory {
    scope: string;
    kind?: MemoryKind;
    content: string;
    importance?: number;
    trust?: number;
    writer: string;
    sourceUmo?: string;
    sourceSession?: string;
    sourceFrom?: number;
    sourceTo?: number;
    /** 这条取代了哪条旧记忆（旧记忆的原文或接近的说法） */
    replaces?: string;
}
export type AddResult = {
    action: 'added';
    id: number;
    superseded?: number;
} | {
    action: 'merged';
    id: number;
} | {
    action: 'blocked';
} | {
    action: 'empty';
};
/** 一个会话自己的记忆归属。 */
export declare function ownScope(scope: Scope): string;
/** 这个会话能想起哪些归属的记忆；主人还能想起所有群的（排名时打折）。 */
export declare function visibleScopes(scope: Scope): {
    scopes: string[];
    allGroups: boolean;
};
/** 写入时的默认可信度。 */
export declare function defaultTrust(category: Category, writer: string): number;
export interface ListQuery {
    scope?: string;
    status?: 'active' | 'forgotten' | 'superseded' | 'all';
    q?: string;
    limit?: number;
    offset?: number;
}
export declare class MemoryStore {
    private readonly db;
    private readonly tz;
    private index;
    /** 每次写入加一，关键词索引和召回缓存据此失效 */
    version: number;
    constructor(db: DatabaseSync, tz?: () => string);
    private changed;
    get(id: number): Memory | undefined;
    /** 正常状态（没遗忘、没被取代）的记忆，按归属。 */
    active(scopes: readonly string[], allGroups?: boolean): Memory[];
    /** 所有正常状态记忆的关键词索引（写入后自动重建）。 */
    keywordIndex(): KeywordIndex;
    /** 写一条：空的不写、彻底遗忘过的不写回来、几乎一样的合并。 */
    add(m: NewMemory): AddResult;
    /** 某个归属在一段时间里新写的记忆（写日记用）。 */
    createdBetween(scope: string, from: number, to: number): Memory[];
    /** 改内容（设置页）。 */
    edit(id: number, content: string): boolean;
    /** 普通遗忘：不再被想起，原文保留，可以恢复。 */
    forget(id: number): boolean;
    /** 恢复：普通遗忘的回到正常；被取代的取消取代。 */
    restore(id: number): boolean;
    /** 彻底遗忘：删掉原文，只留指纹。 */
    purge(id: number): boolean;
    /** 想起来了：记次数、时间，重要程度稍微回升。 */
    markRecalled(ids: readonly number[]): void;
    list(q: ListQuery): {
        total: number;
        items: Memory[];
    };
    stats(): {
        active: number;
        forgotten: number;
        superseded: number;
        tombstones: number;
        byScope: Record<string, number>;
    };
    /** 还没有当前模型向量的记忆（含已遗忘的，恢复后不用重算），跳过 skip 里的。 */
    missingEmbeddings(model: string, limit: number, skip?: ReadonlySet<number>): Array<{
        id: number;
        content: string;
    }>;
    countEmbedded(model: string): {
        total: number;
        embedded: number;
    };
    setEmbedding(id: number, vector: Float32Array, model: string): void;
    /** 当前模型的向量（只要正常状态的）。 */
    embeddings(model: string, ids: readonly number[]): Map<number, Uint8Array>;
    clearEmbeddings(): void;
}
