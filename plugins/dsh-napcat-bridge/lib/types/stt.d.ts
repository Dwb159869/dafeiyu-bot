import type { Component } from './components.js';
export interface SttSettings {
    mode: 'off' | 'command' | 'openai';
    command: string;
    apiUrl: string;
    apiKey: string;
    model: string;
}
type CallAction = (action: string, params: Record<string, unknown>) => Promise<any>;
/** 一段静音的 wav（16kHz、单声道、16 位），测试用。 */
export declare function silentWav(ms?: number): Uint8Array;
/** 设置页「测试」：拿一段静音试一下当前的语音转文字设置能不能用。 */
export declare function testStt(s: SttSettings): Promise<{
    ok: true;
    ms: number;
    text: string;
} | {
    ok: false;
    error: string;
}>;
/** 把一段语音转成文字；失败抛错。 */
export declare function transcribe(comp: Component, s: SttSettings, callAction: CallAction): Promise<string>;
export {};
