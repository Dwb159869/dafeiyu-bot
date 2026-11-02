import { type ApiTarget } from './chat.js';
import { type Memory, type MemoryKind } from './memory.js';
/**
 * 用哪个模型。provider/model 是 dsh 里的；带 api 时不走 dsh，直接调别家（provider 固定写 'api'）。
 * effort：思考等级（dsh 模型按模型自己支持的等级；不支持就不传）。
 */
export interface ModelTarget {
    provider: string;
    model: string;
    effort?: string;
    api?: ApiTarget;
}
export interface LlmLike {
    stream(options: Record<string, unknown>): AsyncIterable<unknown>;
    resolveModelInfo?(provider: string, model: string): Promise<{
        reasoning?: {
            efforts: ReadonlyArray<{
                id: string;
                name?: string;
            }>;
            defaultEffort?: string;
        };
    }>;
}
/** 这个 dsh 模型支持哪些思考等级（缓存 10 分钟；查不到当作不支持）。 */
export declare function dshEfforts(llm: LlmLike, provider: string, model: string): Promise<string[]>;
/** 想要的等级这个模型支持就用；不支持就不传（用模型自己的默认）。 */
export declare function effortFor(llm: LlmLike, target: ModelTarget): Promise<string | undefined>;
/** 发一条提示词，拿回文字。 */
export declare function complete(llm: LlmLike, target: ModelTarget, prompt: string, maxTokens?: number, signal?: AbortSignal): Promise<string>;
export interface Extracted {
    content: string;
    kind: MemoryKind;
    importance: number;
    replaces?: string;
}
/** 「这段聊天是谁的」说明，写进提示词。 */
export declare function whoText(category: 'master' | 'private' | 'group', id?: string): string;
export declare function extractionPrompt(transcript: readonly string[], who: string, existing: readonly string[]): string;
export declare function parseExtracted(text: string): Extracted[];
export declare function cleanupPrompt(items: readonly Memory[]): string;
export declare function parseCleanup(text: string, allowed: ReadonlySet<number>): Array<{
    id: number;
    reason: string;
}>;
