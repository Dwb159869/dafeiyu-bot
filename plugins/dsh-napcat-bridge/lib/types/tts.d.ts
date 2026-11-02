export type TtsProvider = 'breeze' | 'inworld';
export type TtsMode = 'tag' | 'always' | 'chance';
export interface TtsSettings {
    enabled: boolean;
    mode: TtsMode;
    /** chance 模式：一次回复用语音的概率（0–100） */
    chance: number;
    adminPrivate: boolean;
    private: boolean;
    group: boolean;
    /** 超过这么多字的一段不念，发文字 */
    maxChars: number;
    /** 语音后面再发一条文字 */
    alsoText: boolean;
    /** 念之前去掉括号里的动作、表情描写 */
    stripParens: boolean;
    /** 语速，百分比（100 = 正常） */
    speed: number;
    /** 算「第二天」用的时区 */
    timezone: string;
    breeze: {
        key: string;
        voiceId: string;
        model: string;
        language: string;
    };
    inworld: {
        key: string;
        voiceId: string;
        model: string;
    };
}
export declare const VOICE_TAG = "[\u8BED\u97F3]";
export interface Speech {
    audio: Buffer;
    provider: TtsProvider;
    ms: number;
}
export declare class TtsError extends Error {
    readonly status?: number | undefined;
    readonly exhausted: boolean;
    constructor(message: string, status?: number | undefined, exhausted?: boolean);
}
export declare function breezeSpeak(s: TtsSettings, text: string, doFetch?: typeof fetch): Promise<Buffer>;
export declare function inworldSpeak(s: TtsSettings, text: string, doFetch?: typeof fetch): Promise<Buffer>;
/** 念之前把文字收拾一下：去掉 [语音] 记号、Markdown 符号，按设置去掉括号里的动作描写。 */
export declare function speakableText(text: string, stripParens: boolean): string;
export declare function stripTags(text: string): string;
/** 这个会话能不能发语音。 */
export declare function ttsActive(s: TtsSettings, kind: {
    group: boolean;
    adminPrivate: boolean;
}): boolean;
/** 「她自己决定」模式下，每条消息附带的提示（告诉她怎么发语音）。 */
export declare function ttsHint(s: TtsSettings): string;
export interface Piece {
    text: string;
    voice: boolean;
}
/**
 * 把要发的几段（已经按分段设置拆好）标上哪段用语音。
 * tag 模式下没开分段时，也把 [语音] 开头的行单独拿出来（文字行连在一起还是一条）。
 */
export declare function planPieces(segments: string[], s: TtsSettings, active: boolean, random?: () => number): Piece[];
export interface TtsStatus {
    today: {
        date: string;
        breeze: number;
        inworld: number;
        failed: number;
        breezeChars: number;
        inworldChars: number;
    };
    lastError?: {
        at: number;
        text: string;
    };
    /** 最近一次 Breeze 没成功、改用 Inworld 的原因 */
    lastFallback?: {
        at: number;
        text: string;
    };
}
export interface TtsDeps {
    settings(): TtsSettings;
    log(level: 'info' | 'warn', message: string): void;
    now?(): number;
    fetch?: typeof fetch;
}
export declare class Tts {
    private readonly deps;
    private today;
    private lastError?;
    private lastFallback?;
    constructor(deps: TtsDeps);
    private now;
    status(): TtsStatus;
    private roll;
    /** 合成一段语音：先 Breeze，不行 Inworld；都不行抛错。 */
    speak(raw: string): Promise<Speech>;
}
/** 设置页「试听」：只用指定的那一家。 */
export declare function testSpeak(s: TtsSettings, provider: TtsProvider, text: string, doFetch?: typeof fetch): Promise<{
    ok: true;
    ms: number;
    audio: string;
} | {
    ok: false;
    error: string;
}>;
/** 某个时区里的日期 YYYY-MM-DD */
export declare function dayOf(t: number, timezone: string): string;
