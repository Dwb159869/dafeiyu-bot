export declare class TtlCache<V> {
    private readonly ttlMs;
    private readonly max;
    private readonly map;
    constructor(ttlMs: number, max: number);
    get(key: string): V | undefined;
    has(key: string): boolean;
    set(key: string, value: V): void;
    /** 同一个 key 并发请求只发一次；结果（包括失败时的 fallback）缓存起来。 */
    getOrLoad(key: string, load: () => Promise<V>): Promise<V>;
    private readonly pending;
}
