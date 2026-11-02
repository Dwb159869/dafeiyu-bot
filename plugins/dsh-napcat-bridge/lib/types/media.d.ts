import type { Component } from './components.js';
import { type VideoSettings } from './ffmpeg.js';
import { type LoadedImage } from './images.js';
import { type SttSettings } from './stt.js';
import type { Logger } from './onebot/server.js';
type CallAction = (action: string, params: Record<string, unknown>) => Promise<any>;
export interface MediaSettings {
    /** 图片交给模型（视频截图也算图片） */
    imageToModel: boolean;
    /** 一条消息最多几张图（含视频截图）；0 = 不限 */
    maxImages: number;
    stt: SttSettings;
    video: VideoSettings;
}
export interface MediaDeps {
    callAction: CallAction;
    settings(): MediaSettings;
    /** dsh 附件服务（可选；没有时图片不交给模型） */
    attachments(): {
        admitPromptContent(content: readonly unknown[]): Promise<unknown[]>;
    } | undefined;
    log: Logger;
}
/** 交给模型的一块内容（还没经过 dsh 附件服务）。 */
export type ModelPart = {
    type: 'text';
    text: string;
} | {
    type: 'image';
    mediaType: string;
    data: string;
    name?: string;
};
export interface Converted {
    /** 写进消息文字里的部分：语音转出的文字、[视频] 之类的占位 */
    text: string;
    /** 图片和视频截图（前面带说明文字） */
    parts: ModelPart[];
    /** 用掉了几张图片的额度 */
    used: number;
    /** 没读出来的图片数 */
    failed: number;
}
export declare class Media {
    private readonly deps;
    constructor(deps: MediaDeps);
    /** dsh 附件服务在不在（不在时图片交不过去，也就不用去读）。 */
    canAttach(): boolean;
    /** 一段语音写成什么文字：[语音] 转出的文字 / [语音]（没配转文字）/ [语音，没听清]。 */
    voiceText(comp: Component): Promise<string>;
    /** 读一张图片（url / base64 / NapCat get_image）。 */
    loadImage(comp: Component): Promise<LoadedImage>;
    /** 视频在哪：本地路径或 http(s) 地址，以及大小（知道的话）。 */
    private videoSource;
    /**
     * 一个视频变成什么：截图（前面一句说明）或者占位文字。
     * @param budget - 还能用几张图片的额度
     */
    video(comp: Component, budget?: number): Promise<{
        text: string;
        parts: ModelPart[];
    }>;
    /**
     * 把一串消息组件里的图片、语音、视频转成模型内容（文字部分不管，调用方自己拼）。
     * @param budget - 最多用几张图片；不传按设置里的「每条消息最多几张图片」
     */
    convert(components: readonly Component[], budget?: number): Promise<Converted>;
    /** 交给 dsh 附件服务（图片要先过这一步）；没有附件服务或失败时去掉图片只留文字。 */
    admit(content: readonly unknown[]): Promise<unknown[]>;
}
export {};
