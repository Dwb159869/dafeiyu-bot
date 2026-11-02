// 本插件新增（不在 AstrBot 里）：带过期时间和容量上限的简单缓存。
export class TtlCache {
    ttlMs;
    max;
    map = new Map();
    constructor(ttlMs, max) {
        this.ttlMs = ttlMs;
        this.max = max;
    }
    get(key) {
        const hit = this.map.get(key);
        if (hit === undefined)
            return undefined;
        if (hit.expires <= Date.now()) {
            this.map.delete(key);
            return undefined;
        }
        return hit.value;
    }
    has(key) {
        return this.get(key) !== undefined;
    }
    set(key, value) {
        this.map.delete(key);
        this.map.set(key, { value, expires: Date.now() + this.ttlMs });
        // Map 按插入顺序迭代，超出上限时删最早的
        while (this.map.size > this.max) {
            const oldest = this.map.keys().next().value;
            if (oldest === undefined)
                break;
            this.map.delete(oldest);
        }
    }
    /** 同一个 key 并发请求只发一次；结果（包括失败时的 fallback）缓存起来。 */
    async getOrLoad(key, load) {
        const cached = this.get(key);
        if (cached !== undefined)
            return cached;
        const pending = this.pending.get(key);
        if (pending !== undefined)
            return pending;
        const task = load().then(value => {
            this.set(key, value);
            return value;
        }).finally(() => this.pending.delete(key));
        this.pending.set(key, task);
        return task;
    }
    pending = new Map();
}
