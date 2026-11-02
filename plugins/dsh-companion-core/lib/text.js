// 关键词检索用的文字处理：中文按相邻两个字切（"主人爱吃" → 主人、人爱、爱吃），英文和数字按词。
// 不需要分词词典，也不依赖 SQLite 全文检索的切分方式；几千条记忆在 JS 里算一遍只要几毫秒。
import { createHash } from 'node:crypto';
const CJK = /[㐀-鿿豈-﫿]/;
/** 规范化：全角转半角、去掉空白和常见标点、小写。用于算指纹和判断"几乎一样"。 */
export function normalize(text) {
    return text
        .normalize('NFKC')
        .toLowerCase()
        .replace(/[\s\p{P}\p{S}]+/gu, '');
}
/** 内容指纹：规范化后的 SHA-256 前 16 字节。彻底遗忘后只留它，防止同样的内容"复活"。 */
export function fingerprint(text) {
    return createHash('sha256').update(normalize(text)).digest('hex').slice(0, 32);
}
/** 切成检索用的词：中文相邻两字、单个汉字（只在整段只有一个字时）、英文/数字词。 */
export function tokens(text) {
    const out = [];
    const s = text.normalize('NFKC').toLowerCase();
    let run = '';
    const flushRun = () => {
        if (run.length === 1)
            out.push(run);
        for (let i = 0; i + 1 < run.length; i++)
            out.push(run.slice(i, i + 2));
        run = '';
    };
    let word = '';
    for (const ch of s) {
        if (CJK.test(ch)) {
            if (word !== '') {
                out.push(word);
                word = '';
            }
            run += ch;
        }
        else if (/[a-z0-9]/.test(ch)) {
            if (run !== '')
                flushRun();
            word += ch;
        }
        else {
            if (run !== '')
                flushRun();
            if (word !== '') {
                out.push(word);
                word = '';
            }
        }
    }
    if (run !== '')
        flushRun();
    if (word !== '')
        out.push(word);
    return out;
}
/** 很常见、几乎不说明话题的两字词，算分时权重压低。 */
const STOP = new Set(['什么', '怎么', '这个', '那个', '一个', '我们', '你们', '他们', '就是', '还是', '没有', '可以', '现在', '今天', '一下', '知道', '觉得', '不是', '是不', '的话', '了吗', '吗？']);
export function buildIndex(items) {
    const docs = new Map();
    const df = new Map();
    for (const item of items) {
        const set = new Set(tokens(item.content));
        docs.set(item.id, set);
        for (const t of set)
            df.set(t, (df.get(t) ?? 0) + 1);
    }
    return { docs, df };
}
/**
 * 关键词相关度（0–1）：问题里的词有多少出现在这条记忆里，按"越少见的词越重要"加权。
 * 1 表示问题里的词全都出现了。
 * 本插件新增：同一次召回共用分词和权重，不为每条候选记忆重复计算查询。
 */
export function keywordScorer(index, query) {
    const n = Math.max(1, index.docs.size);
    const weights = [...new Set(tokens(query))].map(t => [t, Math.log(1 + n / (1 + (index.df.get(t) ?? 0))) * (STOP.has(t) ? 0.2 : 1)]);
    const total = weights.reduce((sum, [, weight]) => sum + weight, 0);
    return id => {
        const doc = index.docs.get(id);
        if (doc === undefined || !(total > 0))
            return 0;
        let hit = 0;
        for (const [term, weight] of weights)
            if (doc.has(term))
                hit += weight;
        return hit / total;
    };
}
/** 保留单条打分接口，供现有调用者使用。 */
export function keywordScore(index, query, id) {
    return index.docs.has(id) ? keywordScorer(index, query)(id) : 0;
}
/** 两段文字的相似度（0–1，按词集合的重合）：用来判断"几乎一样"的记忆。 */
export function overlap(a, b) {
    const x = new Set(tokens(a));
    const y = new Set(tokens(b));
    if (x.size === 0 || y.size === 0)
        return normalize(a) === normalize(b) ? 1 : 0;
    let common = 0;
    for (const t of x)
        if (y.has(t))
            common += 1;
    return common / Math.max(x.size, y.size);
}
/** 余弦相似度。 */
export function cosine(a, b) {
    if (a.length !== b.length || a.length === 0)
        return 0;
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        na += a[i] * a[i];
        nb += b[i] * b[i];
    }
    return na > 0 && nb > 0 ? dot / Math.sqrt(na * nb) : 0;
}
export function toBlob(v) {
    return new Uint8Array(v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength));
}
export function fromBlob(b) {
    const copy = new Uint8Array(b);
    return new Float32Array(copy.buffer, 0, Math.floor(copy.byteLength / 4));
}
