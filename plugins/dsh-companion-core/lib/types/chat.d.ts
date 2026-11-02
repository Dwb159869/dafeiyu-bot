export type ThinkStyle = 
/** reasoning_effort: low | medium | high（OpenAI、Gemini、Groq） */
'effort'
/** enable_thinking + thinking_budget（阿里云百炼的通义千问、硅基流动） */
 | 'budget'
/** thinking: { type: enabled | disabled }（智谱 GLM、火山方舟豆包） */
 | 'toggle'
/** reasoning: { effort } / { enabled: false }（OpenRouter） */
 | 'openrouter'
/** 不能调，由模型自己决定 */
 | 'none';
export declare function thinkStyleOf(apiUrl: string): ThinkStyle;
/** 这种写法能选哪些等级（设置页下拉用）。 */
export declare function effortsOf(style: ThinkStyle): string[];
/** 把统一的等级翻成这一家的请求参数。 */
export declare function thinkParams(style: ThinkStyle, effort: string | undefined): Record<string, unknown>;
export interface ApiTarget {
    url: string;
    key: string;
    model: string;
    effort?: string;
}
/** 发一条提示词（可以带一段系统提示），拿回文字。失败抛错。 */
export declare function chatComplete(t: ApiTarget, prompt: string, maxTokens?: number, signal?: AbortSignal, doFetch?: typeof fetch): Promise<string>;
