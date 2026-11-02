// 本插件新增：把消息里的图片、语音、视频变成模型能收的内容。
// 插件一自己用，也通过 ctx.napcat.media 给其他插件（例如记忆插件附带群聊之前几条消息时）用。
//   图片 → 原图（交给 dsh 的附件服务）
//   语音 → 配了语音转文字就转成文字，没配就写 [语音]
//   视频 → 有 ffmpeg 就截几张画面当图片，没有就写 [视频]
import { stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { extractFrames, findFfmpeg, formatDuration } from './ffmpeg.js';
import { loadImage } from './images.js';
import { transcribe } from './stt.js';
const errText = (e) => (e instanceof Error ? e.message : String(e));
const imagePart = (img) => ({ type: 'image', mediaType: img.mediaType, data: img.data, ...(img.name ? { name: img.name } : {}) });
export class Media {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    /** dsh 附件服务在不在（不在时图片交不过去，也就不用去读）。 */
    canAttach() {
        return this.deps.attachments() !== undefined;
    }
    /** 一段语音写成什么文字：[语音] 转出的文字 / [语音]（没配转文字）/ [语音，没听清]。 */
    async voiceText(comp) {
        const stt = this.deps.settings().stt;
        if (stt.mode === 'off')
            return '[语音]';
        try {
            const text = await transcribe(comp, stt, this.deps.callAction);
            return text !== '' ? '[语音] ' + text : '[语音，没听清]';
        }
        catch (e) {
            this.deps.log('warn', '语音转文字失败: ' + errText(e));
            return '[语音，转文字失败]';
        }
    }
    /** 读一张图片（url / base64 / NapCat get_image）。 */
    loadImage(comp) {
        return loadImage(comp, this.deps.callAction);
    }
    /** 视频在哪：本地路径或 http(s) 地址，以及大小（知道的话）。 */
    async videoSource(comp) {
        const local = async (p) => {
            const path = p.startsWith('file://') ? fileURLToPath(p) : p;
            if (!path.startsWith('/') && !/^[A-Za-z]:[\\/]/.test(path))
                return undefined;
            try {
                return { src: path, size: (await stat(path)).size };
            }
            catch {
                return undefined;
            }
        };
        for (const candidate of [String(comp.path || ''), String(comp.file || '')]) {
            if (candidate === '')
                continue;
            const found = await local(candidate);
            if (found !== undefined)
                return found;
        }
        const url = String(comp.url || '');
        const isHttp = (u) => u.startsWith('http://') || u.startsWith('https://');
        const httpSource = async (u) => {
            let size;
            try {
                const head = await fetch(u, { method: 'HEAD', signal: AbortSignal.timeout(10_000) });
                const length = Number(head.headers.get('content-length') ?? NaN);
                if (Number.isFinite(length) && length > 0)
                    size = length;
            }
            catch {
                // 有的服务器不支持 HEAD，不影响截图
            }
            return { src: u, size };
        };
        if (isHttp(url))
            return httpSource(url);
        if (isHttp(String(comp.file || '')))
            return httpSource(String(comp.file));
        // NapCat：get_file 会把视频下载到它的缓存里，返回本地路径或地址
        const file = String(comp.file || '');
        if (file !== '') {
            try {
                const ret = await this.deps.callAction('get_file', { file });
                if (ret?.file) {
                    const found = await local(String(ret.file));
                    if (found !== undefined)
                        return found;
                }
                if (ret?.url && isHttp(String(ret.url)))
                    return httpSource(String(ret.url));
            }
            catch (e) {
                this.deps.log('debug', 'get_file 取视频失败: ' + errText(e));
            }
        }
        return undefined;
    }
    /**
     * 一个视频变成什么：截图（前面一句说明）或者占位文字。
     * @param budget - 还能用几张图片的额度
     */
    async video(comp, budget = Infinity) {
        const s = this.deps.settings();
        if (!s.video.enabled || !s.imageToModel || budget <= 0)
            return { text: '[视频]', parts: [] };
        const ffmpeg = await findFfmpeg(s.video.ffmpegPath);
        if (ffmpeg === undefined)
            return { text: '[视频]', parts: [] };
        const source = await this.videoSource(comp);
        if (source === undefined) {
            this.deps.log('warn', '取不到视频文件，只写 [视频]');
            return { text: '[视频]', parts: [] };
        }
        try {
            const settings = { ...s.video, maxFrames: Math.min(s.video.maxFrames, budget) };
            const got = await extractFrames(ffmpeg.path, source.src, source.size, settings);
            if (got.frames.length === 0)
                return { text: '[视频，没能截到画面]', parts: [] };
            const length = got.duration !== undefined ? '时长 ' + formatDuration(got.duration) + '，' : '';
            const label = got.coverOnly
                ? '[视频，' + length + '太大或太长，只截了 1 张画面]'
                : '[视频，' + length + '以下是从中截取的 ' + got.frames.length + ' 张画面]';
            const parts = [{ type: 'text', text: label }];
            for (const frame of got.frames)
                parts.push({ type: 'image', mediaType: 'image/jpeg', data: Buffer.from(frame).toString('base64') });
            return { text: '[视频]', parts };
        }
        catch (e) {
            this.deps.log('warn', '视频截图失败: ' + errText(e));
            return { text: '[视频，没能截到画面]', parts: [] };
        }
    }
    /**
     * 把一串消息组件里的图片、语音、视频转成模型内容（文字部分不管，调用方自己拼）。
     * @param budget - 最多用几张图片；不传按设置里的「每条消息最多几张图片」
     */
    async convert(components, budget) {
        const s = this.deps.settings();
        let left = budget ?? (s.maxImages > 0 ? s.maxImages : Infinity);
        const texts = [];
        const parts = [];
        let used = 0;
        let failed = 0;
        for (const comp of components) {
            if (comp.type === 'Record') {
                texts.push(await this.voiceText(comp));
            }
            else if (comp.type === 'Image') {
                if (!s.imageToModel || left <= 0)
                    continue;
                try {
                    parts.push(imagePart(await this.loadImage(comp)));
                    left -= 1;
                    used += 1;
                }
                catch (e) {
                    failed += 1;
                    this.deps.log('warn', '图片读取失败: ' + errText(e));
                }
            }
            else if (comp.type === 'Video') {
                const v = await this.video(comp, left);
                texts.push(v.text);
                const frames = v.parts.filter(p => p.type === 'image').length;
                left -= frames;
                used += frames;
                parts.push(...v.parts);
            }
        }
        return { text: texts.join(' '), parts, used, failed };
    }
    /** 交给 dsh 附件服务（图片要先过这一步）；没有附件服务或失败时去掉图片只留文字。 */
    async admit(content) {
        const hasImage = content.some(p => p?.type === 'image');
        if (!hasImage)
            return [...content];
        const textOnly = () => content.filter(p => p?.type !== 'image');
        const attachments = this.deps.attachments();
        if (attachments === undefined)
            return textOnly();
        try {
            return await attachments.admitPromptContent(content);
        }
        catch (e) {
            this.deps.log('warn', '图片交给 dsh 失败，只发文字: ' + errText(e));
            return textOnly();
        }
    }
}
