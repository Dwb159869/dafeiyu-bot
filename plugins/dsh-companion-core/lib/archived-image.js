// 本插件新增：正式回复和主动聊天共用存档图片读取，保持文件名校验及原有 MIME 回退规则。
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
const MIME = new Map([['png', 'image/png'], ['gif', 'image/gif'], ['webp', 'image/webp']]);
export function archivedImage(dir, name) {
    if (typeof name !== 'string' || !/^[0-9a-f]{64}\.[a-z0-9]+$/.test(name))
        return undefined;
    const path = join(dir, name);
    if (!existsSync(path))
        return undefined;
    return { type: 'image', mediaType: MIME.get(name.slice(name.lastIndexOf('.') + 1)) ?? 'image/jpeg', data: readFileSync(path).toString('base64') };
}
