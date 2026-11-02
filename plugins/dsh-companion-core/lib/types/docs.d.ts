/** 插件数据目录：<DSH_HOME>/companion */
export declare function defaultDataDir(): string;
/** 先写临时文件再改名，写到一半断电也不会把原文件弄坏。 */
export declare function writeAtomic(path: string, content: string | Uint8Array): void;
export interface DocVersion {
    /** 版本 id（时间 + 随机数），也是文件名 */
    id: string;
    /** 保存这个旧版本的时间（毫秒） */
    time: number;
    /** 是谁改掉的它：settings（设置页）、tool（她自己用工具改）、restore（回退） */
    by: string;
    /** 改的时候在哪个会话（她自己改时有） */
    sessionId?: string;
    reason?: string;
    /** 字数 */
    length: number;
}
export interface WriteMeta {
    by: string;
    sessionId?: string;
    reason?: string;
}
/** 一个带历史版本的文本文件。 */
export declare class TextDoc {
    readonly path: string;
    readonly historyDir: string;
    private readonly keep;
    private cache;
    /**
     * @param path - 文件路径
     * @param historyDir - 历史版本目录
     * @param keep - 最多留几份历史（读的时候取当前值，设置页改了立即生效）
     */
    constructor(path: string, historyDir: string, keep: () => number);
    /** 当前内容；文件不存在时是空字符串。 */
    read(): string;
    /** 写入新内容；旧内容不同且不为空时先存成历史版本。返回存下的历史版本（没存时 undefined）。 */
    write(content: string, meta: WriteMeta): DocVersion | undefined;
    /** 历史版本，最新的在前。 */
    history(): DocVersion[];
    /** 读某个历史版本的内容。 */
    version(id: string): string | undefined;
    /** 回退到某个历史版本（当前内容也会先存成历史）。 */
    restore(id: string): boolean;
    /** 超过份数的旧版本删掉（只删本插件自己存的历史）。 */
    prune(): void;
}
/** 在一段文字里把 oldText 换成 newText；oldText 为空表示追加到末尾。oldText 必须恰好出现一次。 */
export declare function applyEdit(current: string, oldText: string, newText: string): {
    ok: true;
    text: string;
} | {
    ok: false;
    error: string;
};
