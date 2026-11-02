import { type MemoryStore } from './memory.js';
import type { Scope } from './rules.js';
export interface MemoryToolDeps {
    store: MemoryStore;
    scope(sessionId: string): Scope;
    /** 关键词 + 向量召回（工具用：条数多一点） */
    search(scope: Scope, query: string, limit: number): Promise<Array<{
        id: number;
        content: string;
        scope: string;
        createdAt: number;
    }>>;
    /** 这个会话的遗忘方式 */
    forgetMode(scope: Scope): 'normal' | 'purge';
    afterWrite(): void;
    log(level: 'info' | 'warn', message: string): void;
}
export declare function searchTool(deps: MemoryToolDeps): import("@deepseek-ai/dsh-tools").ToolDefinition;
export declare function saveTool(deps: MemoryToolDeps): import("@deepseek-ai/dsh-tools").ToolDefinition;
export declare function forgetTool(deps: MemoryToolDeps): import("@deepseek-ai/dsh-tools").ToolDefinition;
