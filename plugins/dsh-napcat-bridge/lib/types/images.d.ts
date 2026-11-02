import type { Component } from './components.js';
export type ImageMediaType = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';
export interface LoadedImage {
    mediaType: ImageMediaType;
    data: string;
    name?: string;
}
/** 按文件头判断格式；不是 dsh 支持的四种就返回 undefined。 */
export declare function sniffImage(bytes: Uint8Array): ImageMediaType | undefined;
/**
 * 读一张图片：先用 url 下载；不行再调 NapCat 的 get_image（带 base64 或本地路径）。
 * @param callAction - 调 OneBot API
 */
export declare function loadImage(comp: Component, callAction: (action: string, params: Record<string, unknown>) => Promise<any>): Promise<LoadedImage>;
