// 向量检索：调 OpenAI 兼容的 /embeddings 接口（默认硅基流动的 BAAI/bge-m3），向量存在记忆表里（连同模型名）。
// 没填 Key 时不启用。换了模型时自动重建（只给"还没有当前模型向量"的记忆补算），也能在设置页手动重建、暂停、取消。
// 重建期间关键词检索照常工作。
export function embedEnabled(s) {
    return s.apiKey.trim() !== '' && s.apiUrl.trim() !== '' && s.model.trim() !== '';
}
const TIMEOUT_MS = 60_000;
/** 把一批文字变成向量。失败抛错。 */
export async function embed(texts, s, doFetch = fetch) {
    if (texts.length === 0)
        return [];
    const url = s.apiUrl.trim().replace(/\/+$/, '') + '/embeddings';
    const res = await doFetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + s.apiKey.trim() },
        body: JSON.stringify({ model: s.model.trim(), input: texts, encoding_format: 'float' }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
        let detail = '';
        try {
            detail = (await res.text()).slice(0, 200);
        }
        catch { /* 读不到就算了 */ }
        throw new Error('向量接口返回 HTTP ' + res.status + (detail ? '：' + detail : ''));
    }
    const json = await res.json();
    const data = [...(json.data ?? [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    if (data.length !== texts.length)
        throw new Error('向量接口返回的条数不对（要 ' + texts.length + ' 条，给了 ' + data.length + ' 条）');
    return data.map(d => {
        if (!Array.isArray(d.embedding) || d.embedding.length === 0)
            throw new Error('向量接口没返回向量');
        return Float32Array.from(d.embedding);
    });
}
/** 设置页「测试」：用当前设置算一句话的向量，看接口通不通、Key 对不对、模型名对不对。 */
export async function testEmbed(s, doFetch = fetch) {
    if (s.apiUrl.trim() === '')
        return { ok: false, error: '还没填接口地址' };
    if (s.apiKey.trim() === '')
        return { ok: false, error: '还没填 Key' };
    if (s.model.trim() === '')
        return { ok: false, error: '还没填模型' };
    const start = Date.now();
    try {
        const [v] = await embed(['连通性测试'], s, doFetch);
        return { ok: true, model: s.model.trim(), dim: v.length, ms: Date.now() - start };
    }
    catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
}
const MAX_ERRORS = 20;
const MAX_FAILS_IN_ROW = 3;
export class Indexer {
    store;
    settings;
    meta;
    log;
    doFetch;
    job;
    stop;
    skip = new Set();
    st = { state: 'idle', model: '', total: 0, embedded: 0, errors: [] };
    constructor(store, settings, meta, log, doFetch = fetch) {
        this.store = store;
        this.settings = settings;
        this.meta = meta;
        this.log = log;
        this.doFetch = doFetch;
    }
    state() {
        const s = this.settings();
        const counts = this.store.countEmbedded(s.model.trim());
        const dim = Number(this.meta.get('embed_dim:' + s.model.trim()) ?? NaN);
        return {
            ...this.st,
            state: embedEnabled(s) ? this.st.state : 'disabled',
            model: s.model.trim(),
            ...(Number.isFinite(dim) ? { dim } : {}),
            total: counts.total,
            embedded: counts.embedded,
        };
    }
    /** 设置变了或有新记忆时调用：启用了、有缺的就在后台补算（暂停或取消时不自动开始）。 */
    ensure() {
        if (!embedEnabled(this.settings()) || this.job !== undefined)
            return;
        if (this.st.state === 'paused' || this.st.state === 'cancelled' || this.st.state === 'failed')
            return;
        const s = this.settings();
        if (this.store.missingEmbeddings(s.model.trim(), 1, this.skip).length === 0)
            return;
        this.start(false);
    }
    /** 开始（或重新开始）。full = 先清掉所有向量再全部重算（设置页「手动重建」）。 */
    start(full) {
        if (!embedEnabled(this.settings()))
            return;
        if (this.job !== undefined) {
            if (this.stop === 'pause')
                this.stop = undefined;
            return;
        }
        if (full) {
            this.store.clearEmbeddings();
            this.skip.clear();
        }
        const model = this.settings().model.trim();
        const todo = this.store.countEmbedded(model);
        this.st = { state: 'running', model, total: todo.total, embedded: todo.embedded, todo: todo.total - todo.embedded, done: 0, errors: full ? [] : this.st.errors, startedAt: Date.now() };
        this.stop = undefined;
        this.job = this.run().finally(() => { this.job = undefined; });
    }
    pause() {
        if (this.job !== undefined)
            this.stop = 'pause';
    }
    cancel() {
        if (this.job !== undefined)
            this.stop = 'cancel';
        else if (this.st.state === 'paused')
            this.st = { ...this.st, state: 'cancelled', finishedAt: Date.now() };
    }
    /** 等当前任务结束（测试用）。 */
    async idle() {
        await this.job;
    }
    async run() {
        let fails = 0;
        for (;;) {
            if (this.stop !== undefined) {
                this.st = { ...this.st, state: this.stop === 'pause' ? 'paused' : 'cancelled', finishedAt: Date.now() };
                this.log('info', '向量索引' + (this.stop === 'pause' ? '暂停' : '取消'));
                return;
            }
            const s = this.settings();
            const model = s.model.trim();
            if (!embedEnabled(s)) {
                this.st = { ...this.st, state: 'idle', finishedAt: Date.now() };
                return;
            }
            const batch = this.store.missingEmbeddings(model, Math.max(1, Math.min(64, s.batch)), this.skip);
            if (batch.length === 0) {
                this.st = { ...this.st, state: 'done', finishedAt: Date.now() };
                this.log('info', '向量索引已完成（' + model + '）');
                return;
            }
            try {
                const vectors = await embed(batch.map(b => b.content), s, this.doFetch);
                for (let i = 0; i < batch.length; i++)
                    this.store.setEmbedding(batch[i].id, vectors[i], model);
                this.meta.set('embed_dim:' + model, String(vectors[0].length));
                this.st = { ...this.st, done: (this.st.done ?? 0) + batch.length };
                fails = 0;
            }
            catch (e) {
                const error = e instanceof Error ? e.message : String(e);
                fails += 1;
                this.st = { ...this.st, lastError: error };
                if (batch.length === 1) {
                    // 单条也失败：记下来跳过，别卡住整个重建
                    this.skip.add(batch[0].id);
                    this.st.errors = [...this.st.errors, { id: batch[0].id, error }].slice(-MAX_ERRORS);
                }
                if (fails >= MAX_FAILS_IN_ROW) {
                    this.st = { ...this.st, state: 'failed', finishedAt: Date.now() };
                    this.log('warn', '向量索引失败：' + error);
                    return;
                }
                await new Promise(r => setTimeout(r, 1000 * fails));
            }
        }
    }
}
