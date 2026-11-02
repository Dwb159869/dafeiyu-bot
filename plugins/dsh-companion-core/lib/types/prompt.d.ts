/** dsh-system-prompt 的段名（PERSONA_PREFIX_SECTION / 内置身份句）。 */
export declare const PERSONA_SECTION = "deployment:persona-prefix";
export declare const IDENTITY_SECTION = "harness:identity";
export declare const CORE_SECTION = "companion:core-memory";
export interface AssembledSection {
    name: string;
    text: string;
    interpolate?: boolean;
}
export interface AssemblyLike {
    sections: AssembledSection[];
    contexts: unknown[];
    tools: unknown[];
    variables: Record<string, string | undefined>;
}
export interface PromptParts {
    /** 人格稿；空 = 不动 dsh 原来的人格 */
    persona: string;
    /** 核心记忆（这个会话能看到的那份）；空 = 不加 */
    core: string;
    /** 去掉 dsh 的编程助手身份句（"You are an AI agent powered by DeepSeek Harness."） */
    personaOnly: boolean;
}
/** 核心记忆前后加个说明，让她知道这是她自己一直记得的事。 */
export declare function coreBlock(core: string): string;
/** 改一次组装结果：换人格、加核心记忆。人格和核心记忆都为空时原样返回。 */
export declare function applyPrompt<T extends AssemblyLike>(assembly: T, parts: PromptParts): T;
