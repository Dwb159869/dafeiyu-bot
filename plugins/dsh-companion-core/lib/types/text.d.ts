/** 规范化：全角转半角、去掉空白和常见标点、小写。用于算指纹和判断"几乎一样"。 */
export declare function normalize(text: string): string;
/** 内容指纹：规范化后的 SHA-256 前 16 字节。彻底遗忘后只留它，防止同样的内容"复活"。 */
export declare function fingerprint(text: string): string;
/** 切成检索用的词：中文相邻两字、单个汉字（只在整段只有一个字时）、英文/数字词。 */
export declare function tokens(text: string): string[];
export interface KeywordIndex {
    /** 每条记忆的词集合 */
    docs: Map<number, Set<string>>;
    /** 每个词出现在几条记忆里 */
    df: Map<string, number>;
}
export declare function buildIndex(items: Iterable<{
    id: number;
    content: string;
}>): KeywordIndex;
/**
 * 关键词相关度（0–1）：问题里的词有多少出现在这条记忆里，按"越少见的词越重要"加权。
 * 1 表示问题里的词全都出现了。
 * 本插件新增：同一次召回共用分词和权重，不为每条候选记忆重复计算查询。
 */
export declare function keywordScorer(index: KeywordIndex, query: string): (id: number) => number;
/** 保留单条打分接口，供现有调用者使用。 */
export declare function keywordScore(index: KeywordIndex, query: string, id: number): number;
/** 两段文字的相似度（0–1，按词集合的重合）：用来判断"几乎一样"的记忆。 */
export declare function overlap(a: string, b: string): number;
/** 余弦相似度。 */
export declare function cosine(a: Float32Array, b: Float32Array): number;
export declare function toBlob(v: Float32Array): Uint8Array;
export declare function fromBlob(b: Uint8Array): Float32Array;
