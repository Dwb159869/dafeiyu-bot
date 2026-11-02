import { type LlmLike, type ModelTarget } from './extract.js';
export interface GuardSettings {
    enabled: boolean;
    review: boolean;
    /** 一次最多加几个字（新内容比原文多出来的部分） */
    maxEditChars: number;
    /** 人格最多几个字（已经超过时只许变短） */
    maxTotalChars: number;
    allowed: readonly string[];
    forbidden: readonly string[];
}
export declare const DEFAULT_ALLOWED: string[];
export declare const DEFAULT_FORBIDDEN: string[];
/** 数字数：不算空白（空格、换行），中文英文都是一个字一个 */
export declare const countChars: (s: string) => number;
/** 硬规则。返回 undefined 表示通过，否则是退回的原因。 */
export declare function checkPersonaEdit(current: string, next: string, newText: string, s: GuardSettings): string | undefined;
export declare function reviewPrompt(current: string, oldText: string, newText: string, reason: string, s: GuardSettings): string;
export declare function parseReview(text: string): {
    ok: boolean;
    reason: string;
};
export interface GuardDeps {
    settings(): GuardSettings;
    llm(): LlmLike | undefined;
    target(): ModelTarget | undefined;
    log(level: 'info' | 'warn', message: string): void;
}
/** 两道关都过了返回 undefined，否则返回给她看的退回原因。 */
export declare function guardPersonaEdit(deps: GuardDeps, current: string, next: string, oldText: string, newText: string, reason: string): Promise<string | undefined>;
