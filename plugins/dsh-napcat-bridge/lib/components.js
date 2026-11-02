// 移植自 AstrBot astrbot/core/message/components.py（AGPL-3.0-or-later）。
// AstrBot 用 pydantic 模型；这里每个组件是 { type, ...字段 } 的普通对象，
// 只保留 AstrBot 模型里声明过的字段（pydantic 会忽略未声明的字段）。
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { isAbsolute, resolve as resolvePath } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
/** 各组件在 AstrBot 里声明的字段及默认值（未传时用默认值，与 pydantic 一致）。 */
const FIELDS = {
    Plain: { text: undefined, convert: true },
    Image: { file: '', _type: '', url: '', path: '' },
    Record: { file: '', url: '', text: null, path: null },
    Video: { file: undefined, url: '', cover: '', path: '' },
    File: { name: '', file_: '', url: '' },
    Face: { id: undefined },
    At: { qq: undefined, name: '' },
    Node: { id: 0, name: '', uin: '0', content: [], seq: '', time: 0 },
    Nodes: { nodes: [] },
    Poke: { _type: '126', id: 0, qq: 0 },
    Reply: { id: undefined, chain: [], sender_id: 0, sender_nickname: '', time: 0, message_str: '', text: '', qq: 0, seq: 0 },
    Forward: { id: undefined },
    RPS: {},
    Dice: {},
    Shake: {},
    Share: { url: undefined, title: undefined, content: '', image: '' },
    Contact: { _type: undefined, id: 0 },
    Location: { lat: undefined, lon: undefined, title: '', content: '' },
    Music: { _type: undefined, id: 0, url: '', audio: '', title: '', content: '', image: '' },
    Json: { data: undefined },
    Unknown: { text: undefined },
};
/** 构造组件：只取声明过的字段；必填字段（默认 undefined）缺失时抛错，相当于 pydantic 校验失败。 */
export function make(type, data = {}) {
    const comp = { type };
    for (const [key, def] of Object.entries(FIELDS[type])) {
        const value = key in data ? data[key] : def;
        if (value === undefined)
            throw new Error(type + ' 缺少必填字段 ' + key);
        comp[key] = value;
    }
    return comp;
}
export const Plain = (text) => make('Plain', { text });
export const At = (data) => make('At', data);
/** Poke(poke_type=None, **_)：兼容旧签名 Poke(type="poke")，空/poke 时为 "126"。 */
export function Poke(data = {}) {
    const rest = { ...data };
    let pokeType = rest.poke_type;
    const legacy = rest.type;
    delete rest.type;
    delete rest.poke_type;
    if (pokeType === undefined || pokeType === null)
        pokeType = legacy;
    if (pokeType === undefined || pokeType === null || pokeType === '' || pokeType === 'poke' || pokeType === 'Poke')
        pokeType = '126';
    return make('Poke', { ...rest, _type: String(pokeType) });
}
/** File(name, file="", url="") */
export const File = (data) => make('File', { name: data.name, file_: data.file ?? '', url: data.url ?? '' });
/** Json(data: str | dict) */
export function Json(data) {
    let value = data.data;
    if (typeof value === 'string')
        value = JSON.parse(value);
    return make('Json', { data: value });
}
/** OneBot 段类型 → 组件构造（AstrBot ComponentTypes）。 */
export const ComponentTypes = {
    plain: d => make('Plain', d),
    text: d => make('Plain', d),
    image: d => make('Image', d),
    record: d => make('Record', d),
    video: d => make('Video', d),
    file: d => File(d),
    face: d => make('Face', d),
    at: d => make('At', d),
    rps: d => make('RPS', d),
    dice: d => make('Dice', d),
    shake: d => make('Shake', d),
    share: d => make('Share', d),
    contact: d => make('Contact', d),
    location: d => make('Location', d),
    music: d => make('Music', d),
    reply: d => make('Reply', d),
    poke: d => Poke(d),
    forward: d => make('Forward', d),
    node: d => make('Node', d),
    nodes: d => make('Nodes', d),
    json: d => Json(d),
    unknown: d => make('Unknown', d),
};
/** BaseMessageComponent.toDict 及各子类的覆盖。 */
export function toDict(comp) {
    switch (comp.type) {
        case 'Plain':
            return { type: 'text', data: { text: comp.text } };
        case 'At':
            return { type: 'at', data: { qq: String(comp.qq) } };
        case 'Reply':
            return { type: 'reply', data: { id: String(comp.id) } };
        case 'Poke': {
            let target;
            for (const value of [comp.id, comp.qq]) {
                if (value === undefined || value === null)
                    continue;
                const text = String(value).trim();
                if (text !== '' && text !== '0') {
                    target = text;
                    break;
                }
            }
            const data = { type: String(comp._type || '126') };
            if (target !== undefined)
                data.id = target;
            return { type: 'poke', data };
        }
        case 'Nodes':
            return { messages: comp.nodes.map(n => toDict(n)) };
        default: {
            const data = {};
            for (const [k, v] of Object.entries(comp)) {
                if (k === 'type' || v === null || v === undefined)
                    continue;
                data[k === '_type' ? 'type' : k] = v;
            }
            return { type: comp.type.toLowerCase(), data };
        }
    }
}
/** 读取 url/路径/base64 为 base64 文本（MediaResolver.to_base64 的基本行为，不做格式转换）。 */
async function resolveToBase64(source) {
    if (source.startsWith('base64://'))
        return source.slice('base64://'.length);
    if (source.startsWith('data:')) {
        const comma = source.indexOf(',');
        return comma >= 0 ? source.slice(comma + 1) : '';
    }
    if (source.startsWith('http://') || source.startsWith('https://')) {
        const res = await fetch(source);
        if (!res.ok)
            throw new Error('下载失败: ' + res.status + ' ' + source);
        return Buffer.from(await res.arrayBuffer()).toString('base64');
    }
    const path = source.startsWith('file://') ? fileURLToPath(source) : source;
    return (await readFile(path)).toString('base64');
}
/** Image.convert_to_base64 / Record.convert_to_base64 */
export async function convertToBase64(comp) {
    if (comp.type === 'Image') {
        const url = comp.url || comp.file;
        if (!url)
            throw new Error('No valid file or URL provided');
        return resolveToBase64(url);
    }
    const source = comp.path || comp.file || comp.url;
    if (!source)
        throw new Error('not a valid file: ' + comp.file);
    return resolveToBase64(source);
}
/** File.get_file(allow_return_url=True)：本地文件存在用本地绝对路径，否则用 url。 */
function fileGetFile(comp) {
    const file = comp.file_;
    if (file) {
        const path = file.startsWith('file://') ? fileURLToPath(file) : file;
        if (existsSync(path))
            return resolvePath(path);
    }
    if (comp.url)
        return comp.url;
    return '';
}
/** BaseMessageComponent.to_dict（异步版）及 File/Video/Node/Nodes 的覆盖。 */
export async function toDictAsync(comp) {
    switch (comp.type) {
        case 'File':
            // 未配置 callback_api_base：直接用路径或 url
            return { type: 'file', data: { name: comp.name, file: fileGetFile(comp) } };
        case 'Video':
            return { type: 'video', data: { file: comp.file } };
        case 'Node': {
            const content = [];
            for (const c of comp.content) {
                if (c.type === 'Image' || c.type === 'Record') {
                    content.push({ type: c.type.toLowerCase(), data: { file: 'base64://' + await convertToBase64(c) } });
                }
                else if (c.type === 'Plain' || c.type === 'File' || c.type === 'Node' || c.type === 'Nodes') {
                    content.push(await toDictAsync(c));
                }
                else {
                    content.push(toDict(c));
                }
            }
            return { type: 'node', data: { user_id: String(comp.uin), nickname: comp.name, content } };
        }
        case 'Nodes': {
            const messages = [];
            for (const node of comp.nodes)
                messages.push(await toDictAsync(node));
            return { messages };
        }
        default:
            return toDict(comp);
    }
}
/** pathlib.Path(x).is_absolute() 且不含 :// 时转 file: URI（AiocqhttpMessageEvent._from_segment_to_dict）。 */
export function toFileUri(value) {
    if (isAbsolute(value) && !value.includes('://'))
        return pathToFileURL(value).href;
    return value;
}
