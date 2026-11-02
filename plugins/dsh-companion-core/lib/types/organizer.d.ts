import type { Archive, ArchivedMessage } from './archive.js';
import { type LlmLike, type ModelTarget } from './extract.js';
import { type MemoryStore } from './memory.js';
import type { Category, Scope } from './rules.js';
export interface OrganizerDeps {
    archive: Archive;
    store: MemoryStore;
    llm(): LlmLike | undefined;
    target(): ModelTarget | undefined;
    log(level: 'debug' | 'info' | 'warn', message: string): void;
    /** 写了新记忆以后（补算向量） */
    afterWrite(): void;
}
export declare function transcriptOf(rows: readonly ArchivedMessage[]): string[];
export declare class Organizer {
    private readonly deps;
    private queue;
    private readonly replies;
    constructor(deps: OrganizerDeps);
    /** 排队执行。 */
    private enqueue;
    /** 记下一个 QQ 会话属于哪一类（存档里只有私聊/群，分不出主人）。 */
    rememberCategory(umo: string, category: Category): void;
    categoryOf(umo: string, kind: string): Category;
    private write;
    /** 整理一个 QQ 会话里还没整理过的部分。返回新写了几条。 */
    organizeUmo(umo: string, reason: string): Promise<number>;
    /** 整理一段直接给出的文字（dsh 会话）。 */
    organizeLines(scope: Scope, sessionId: string, lines: readonly string[], reason: string): Promise<number>;
    /** QQ：她回复了一次。到了 N 轮就整理（0 = 不按轮数整理）。 */
    onReply(umo: string, everyRounds: number): void;
    /** dsh 会话：记下一句话（进聊天流水）；人说的话算一轮，到了 N 轮就整理。 */
    onDshLine(sessionId: string, text: string, human: boolean, everyRounds: number): void;
    /** 整理 dsh 会话流水里还没整理的部分；一条都没有时用 fallback（压缩前给的那几轮）。 */
    flushDsh(sessionId: string, reason: string, fallback?: readonly string[]): Promise<number>;
    /** 设置页「立即整理」：所有有新内容的 QQ 会话 + 所有攒着的 dsh 会话。 */
    organizeAll(): Promise<{
        sessions: number;
        added: number;
    }>;
    /** 还没整理的大概有多少（设置页显示）。 */
    pending(): {
        qqSessions: number;
        qqMessages: number;
        dshSessions: number;
    };
    /** 等排队的整理都做完（测试用）。 */
    idle(): Promise<void>;
}
