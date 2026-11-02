// 本插件新增：分段发送。把她一次的回复拆成几条 QQ 消息，像真人一样一句一条地发。
// 规则：
//   - 按换行拆，空行去掉，每段去掉首尾空白；
//   - ``` 包起来的代码块整段算一条，不拆；
//   - 一行太长（超过 LONG_CHARS）再按句号/问号/感叹号拆开，别整段砸过去；
//   - 最多拆成 maxSegments 条，多出来的并进最后一条（用换行连着），免得刷屏；
//   - 主人私聊、其他私聊、群聊可以分别开关（默认只有主人私聊开）。
// 每一段各自走发消息节奏（打字等待、群里的频率），所以段和段之间也有自然的停顿。
/** 这个会话要不要分段。 */
export function segmentEnabled(s, kind) {
    return kind.group ? s.group : kind.adminPrivate ? s.adminPrivate : s.private;
}
/** 一行太长时按句末标点再拆；代码块不参与（调用方保证）。 */
const LONG_CHARS = 80;
export function splitLongLine(line) {
    if (line.length <= LONG_CHARS)
        return [line];
    const sentences = line.split(/(?<=[。！？!?…～~])\s*/).filter(s => s !== '');
    if (sentences.length <= 1)
        return [line];
    const out = [];
    let cur = '';
    for (const s of sentences) {
        if (cur !== '' && cur.length + s.length > LONG_CHARS) {
            out.push(cur);
            cur = s;
        }
        else
            cur += s;
    }
    if (cur !== '')
        out.push(cur);
    return out.length > 1 ? out : [line];
}
/** 把一次回复拆成几段。 */
export function splitReply(text, maxSegments) {
    const parts = [];
    let code;
    for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
        if (code !== undefined) {
            code.push(raw);
            if (raw.trim().startsWith('```')) {
                parts.push(code.join('\n'));
                code = undefined;
            }
            continue;
        }
        if (raw.trim().startsWith('```')) {
            code = [raw];
            continue;
        }
        const line = raw.trim();
        if (line !== '')
            parts.push(line);
    }
    if (code !== undefined)
        parts.push(code.join('\n'));
    // 本插件新增：整段长文字按句拆开，避免一口气发一大坨
    const expanded = [];
    for (const part of parts) {
        if (part.startsWith('```'))
            expanded.push(part);
        else
            expanded.push(...splitLongLine(part));
    }
    const finalParts = expanded.length > 1 ? expanded : parts;
    const max = Math.max(1, Math.floor(maxSegments));
    if (finalParts.length <= max)
        return finalParts.length > 0 ? finalParts : [text.trim()];
    return [...finalParts.slice(0, max - 1), finalParts.slice(max - 1).join('\n')];
}
