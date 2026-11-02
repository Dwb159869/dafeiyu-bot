import type { DatabaseSync } from 'node:sqlite';
import { type EmbedSettings } from './embed.js';
import { type LlmLike, type ModelTarget } from './extract.js';
import type { Scope } from './rules.js';
export interface GraphSettings {
    enabled: boolean;
    /** 一次让模型看几条记忆 */
    batch: number;
    /** 从提到的实体顺着关系走几步（0–2） */
    hops: number;
}
export interface GraphEntity {
    name: string;
    kind: string;
}
export interface GraphRelation {
    src: string;
    rel: string;
    dst: string;
}
export interface GraphExtract {
    id: number;
    entities: GraphEntity[];
    relations: GraphRelation[];
}
/** 让模型抽关系的提示词。 */
export declare function graphPrompt(items: ReadonlyArray<{
    id: number;
    content: string;
}>): string;
/** 解析模型输出。只保留 ids 里有的记忆；关系两端不在实体里时补成实体。 */
export declare function parseGraph(text: string, ids: readonly number[]): GraphExtract[];
export interface GraphCounts {
    memories: number;
    done: number;
    entities: number;
    relations: number;
}
/** 关系网的表（数据库版本 5 建的）。 */
export declare class GraphStore {
    private readonly db;
    constructor(db: DatabaseSync);
    /** 还没抽过、或者内容改过（指纹变了）的正常记忆。日记太长不抽。 */
    pending(limit: number, skip?: ReadonlySet<number>): Array<{
        id: number;
        scope: string;
        content: string;
        hash: string;
    }>;
    counts(): GraphCounts;
    private entityId;
    /** 存一条记忆抽出来的东西（先清掉这条记忆以前的）。 */
    save(memory: {
        id: number;
        scope: string;
        hash: string;
    }, x: GraphExtract): void;
    /** 去掉一条记忆在关系网里的痕迹（实体留着，没人提到的由 tidy 清掉）。 */
    forgetMemory(memoryId: number): void;
    /** 清掉已经删除的记忆留下的、以及没有任何记忆提到的实体。 */
    tidy(): void;
    /** 全部清空（手动重建）。 */
    clear(): void;
    /** 名字还没有当前向量模型向量的实体。 */
    missingEmbeddings(model: string, limit: number): Array<{
        id: number;
        name: string;
    }>;
    setEmbedding(id: number, v: Float32Array, model: string): void;
    /** 这些归属里的实体（召回用）。 */
    entities(scopes: readonly string[], allGroups: boolean): Array<{
        id: number;
        scope: string;
        name: string;
        norm: string;
        embedding?: Uint8Array;
        model?: string;
    }>;
    mentions(entityId: number): number[];
    /** 和这个实体有关系的实体，带关系所在的记忆。 */
    neighbors(entityId: number): Array<{
        entity: number;
        memory: number;
    }>;
    /** 设置页看看关系网长什么样：最近的几条关系。 */
    sample(limit: number): Array<{
        scope: string;
        src: string;
        rel: string;
        dst: string;
        memory: number;
    }>;
}
/**
 * 图那一路：这条消息提到了哪些实体，顺着关系走几步，给每条记忆一个分数（记忆 id → 分数）。
 * 只看这个会话看得到的归属。中心实体（被很多记忆提到的，比如「主人」）带来的分数按提到次数摊薄，也不从它往外走。
 */
export declare function graphScores(graph: GraphStore, scope: Scope, query: string, hops: number, vector?: {
    query: Float32Array;
    model: string;
}): Map<number, number>;
export interface GraphState {
    state: 'idle' | 'running' | 'paused' | 'done' | 'failed' | 'cancelled' | 'disabled';
    counts: GraphCounts;
    todo?: number;
    done?: number;
    errors: Array<{
        id: number;
        error: string;
    }>;
    lastError?: string;
    startedAt?: number;
    finishedAt?: number;
}
/** 后台补抽关系网：打开开关后对已有记忆补抽一遍，之后每有新记忆就抽新的。可暂停、继续、取消、手动重建。 */
export declare class GraphBuilder {
    private readonly graph;
    private readonly deps;
    private job;
    private stop;
    private skip;
    private st;
    constructor(graph: GraphStore, deps: {
        settings(): GraphSettings;
        llm(): LlmLike | undefined;
        target(): ModelTarget | undefined;
        embedSettings(): EmbedSettings;
        log(level: 'info' | 'warn', message: string): void;
        doFetch?: typeof fetch;
    });
    state(): GraphState;
    ensure(): void;
    private needsEntityVectors;
    start(full: boolean): void;
    pause(): void;
    cancel(): void;
    idle(): Promise<void>;
    private run;
    /** 填了向量 Key 时给实体名算向量（召回时能认出说法不同的同一个东西）。失败不影响关系网。 */
    private embedEntities;
}
/** 把两路排名融合（RRF）：每条记忆的分 = Σ 1/(60 + 名次)。 */
export declare function fuse(docRanked: readonly number[], graphRanked: readonly number[]): Map<number, number>;
