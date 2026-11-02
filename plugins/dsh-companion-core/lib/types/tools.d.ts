import { type TextDoc } from './docs.js';
export interface ToolDeps {
    persona: TextDoc;
    coreMaster: TextDoc;
    corePublic: TextDoc;
    /** 这个会话现在还算不算主人的（执行时再查一次） */
    isMaster(sessionId: string): boolean;
    /** 每份核心记忆最多几个字（不算空白） */
    coreMaxChars(which: 'master' | 'public'): number;
    log(level: 'info' | 'warn', message: string): void;
    /** 改人格前检查（persona-guard.ts）：通过返回 undefined，否则返回退回的原因 */
    guardPersona?(current: string, next: string, oldText: string, newText: string, reason: string): Promise<string | undefined>;
    /** 人格里可以写、不许写什么（写进工具说明） */
    personaRules?(): {
        allowed: readonly string[];
        forbidden: readonly string[];
    };
}
export declare function personaTool(deps: ToolDeps): import("@deepseek-ai/dsh-tools").ToolDefinition;
export declare function coreTool(deps: ToolDeps): import("@deepseek-ai/dsh-tools").ToolDefinition;
