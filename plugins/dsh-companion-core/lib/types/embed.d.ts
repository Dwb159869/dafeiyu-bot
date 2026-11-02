import type { MemoryStore } from './memory.js';
export interface EmbedSettings {
    apiUrl: string;
    apiKey: string;
    model: string;
    batch: number;
}
export declare function embedEnabled(s: EmbedSettings): boolean;
/** 把一批文字变成向量。失败抛错。 */
export declare function embed(texts: readonly string[], s: EmbedSettings, doFetch?: typeof fetch): Promise<Float32Array[]>;
/** 设置页「测试」：用当前设置算一句话的向量，看接口通不通、Key 对不对、模型名对不对。 */
export declare function testEmbed(s: EmbedSettings, doFetch?: typeof fetch): Promise<{
    ok: true;
    model: string;
    dim: number;
    ms: number;
} | {
    ok: false;
    error: string;
}>;
export interface IndexState {
    state: 'idle' | 'running' | 'paused' | 'done' | 'failed' | 'cancelled' | 'disabled';
    model: string;
    dim?: number;
    total: number;
    embedded: number;
    /** 本次重建要算的条数和算完的条数 */
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
export declare class Indexer {
    private readonly store;
    private readonly settings;
    private readonly meta;
    private readonly log;
    private readonly doFetch;
    private job;
    private stop;
    private skip;
    private st;
    constructor(store: MemoryStore, settings: () => EmbedSettings, meta: {
        get(key: string): string | undefined;
        set(key: string, value: string): void;
    }, log: (level: 'info' | 'warn', message: string) => void, doFetch?: typeof fetch);
    state(): IndexState;
    /** 设置变了或有新记忆时调用：启用了、有缺的就在后台补算（暂停或取消时不自动开始）。 */
    ensure(): void;
    /** 开始（或重新开始）。full = 先清掉所有向量再全部重算（设置页「手动重建」）。 */
    start(full: boolean): void;
    pause(): void;
    cancel(): void;
    /** 等当前任务结束（测试用）。 */
    idle(): Promise<void>;
    private run;
}
