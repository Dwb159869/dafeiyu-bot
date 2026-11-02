// 本插件新增（不在 AstrBot 的适配器里）：把消息里的图片读成字节，交给 dsh 的附件服务。
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
/** 单张图片最多读多少字节（dsh 自己还会再压缩）。 */
const MAX_BYTES = 20 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 20_000;
/** 按文件头判断格式；不是 dsh 支持的四种就返回 undefined。 */
export function sniffImage(bytes) {
    if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
        return 'image/png';
    if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
        return 'image/jpeg';
    if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38)
        return 'image/gif';
    if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP')
        return 'image/webp';
    return undefined;
}
async function fetchBytes(url) {
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok)
        throw new Error('HTTP ' + res.status);
    const length = Number(res.headers.get('content-length') ?? 0);
    if (length > MAX_BYTES)
        throw new Error('图片太大 ' + length);
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length > MAX_BYTES)
        throw new Error('图片太大 ' + buf.length);
    return buf;
}
/**
 * 读一张图片：先用 url 下载；不行再调 NapCat 的 get_image（带 base64 或本地路径）。
 * @param callAction - 调 OneBot API
 */
export async function loadImage(comp, callAction) {
    let bytes;
    const errors = [];
    const url = String(comp.url || '');
    const file = String(comp.file || '');
    for (const source of [url, file]) {
        if (bytes !== undefined || source === '')
            continue;
        try {
            if (source.startsWith('http://') || source.startsWith('https://'))
                bytes = await fetchBytes(source);
            else if (source.startsWith('base64://'))
                bytes = Buffer.from(source.slice('base64://'.length), 'base64');
        }
        catch (e) {
            errors.push(source.slice(0, 60) + ': ' + (e instanceof Error ? e.message : String(e)));
        }
    }
    if (bytes === undefined && file !== '') {
        try {
            const ret = await callAction('get_image', { file });
            if (ret?.base64)
                bytes = Buffer.from(String(ret.base64), 'base64');
            else if (ret?.file)
                bytes = await readFile(String(ret.file).startsWith('file://') ? fileURLToPath(String(ret.file)) : String(ret.file));
            else if (ret?.url)
                bytes = await fetchBytes(String(ret.url));
        }
        catch (e) {
            errors.push('get_image: ' + (e instanceof Error ? e.message : String(e)));
        }
    }
    if (bytes === undefined)
        throw new Error('读不到图片（' + errors.join('；') + '）');
    if (bytes.length > MAX_BYTES)
        throw new Error('图片太大 ' + bytes.length);
    const mediaType = sniffImage(bytes);
    if (mediaType === undefined)
        throw new Error('不支持的图片格式');
    return { mediaType, data: Buffer.from(bytes).toString('base64'), name: file || undefined };
}
