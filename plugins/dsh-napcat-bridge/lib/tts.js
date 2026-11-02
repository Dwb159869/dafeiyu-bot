// 本插件新增：文字转语音（她的回复用语音发）。
// 两家接口，先用 BreezeBlue（Breeze TTS 2），不行再用 Inworld（Realtime TTS-2 Flash）：
//   - Breeze：POST https://api.breeze.blue/v1/text-to-speech/{voice_id}?output_format=mp3，头 xi-api-key，返回就是 mp3；
//   - Inworld：POST https://api.inworld.ai/tts/v1/voice，头 Authorization: Basic <Key>，返回 JSON 里 audioContent 是 base64 的 mp3。
// 切换规则：每一条都先试 Breeze；这一条出错（连不上、超时、额度用完、限流、Key 不对……）就这一条改用 Inworld，
// 下一条照样先试 Breeze。两家都不行 → 这一条照常发文字。
// 什么时候发语音：她自己决定（要念的那一行开头写 [语音]）、每条都发、或者按概率；主人私聊 / 其他私聊 / 群聊分别开关。
// Key 只在请求里用，不打印、不写进日志。
export const VOICE_TAG = '[语音]';
const TAG_RE = /\[语音\]|【语音】/g;
export class TtsError extends Error {
    status;
    exhausted;
    constructor(message, status, exhausted = false) {
        super(message);
        this.status = status;
        this.exhausted = exhausted;
    }
}
const TIMEOUT_MS = 20_000;
const BREEZE_URL = 'https://api.breeze.blue/v1/text-to-speech/';
const INWORLD_URL = 'https://api.inworld.ai/tts/v1/voice';
export async function breezeSpeak(s, text, doFetch = fetch) {
    const b = s.breeze;
    if (!b.key.trim())
        throw new TtsError('还没填 BreezeBlue 的 Key');
    if (!b.voiceId.trim())
        throw new TtsError('还没填 BreezeBlue 的音色 id');
    const body = { text };
    if (b.model.trim())
        body.model_id = b.model.trim();
    // 填 auto（或者留空）就不传，让它自己判断
    if (b.language.trim() && b.language.trim().toLowerCase() !== 'auto')
        body.language_code = b.language.trim();
    if (s.speed !== 100)
        body.voice_settings = { speed: clamp(s.speed / 100, 0.5, 2) };
    let res;
    try {
        res = await doFetch(BREEZE_URL + encodeURIComponent(b.voiceId.trim()) + '?output_format=mp3', {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'xi-api-key': b.key.trim() },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
    }
    catch (e) {
        throw new TtsError(netText(e));
    }
    if (!res.ok) {
        const detail = await errorDetail(res);
        const exhausted = res.status === 402 || /CREDIT/i.test(detail);
        throw new TtsError('BreezeBlue 返回 HTTP ' + res.status + hintFor(res.status, exhausted) + (detail ? '：' + detail : ''), res.status, exhausted);
    }
    const audio = Buffer.from(await res.arrayBuffer());
    if (audio.length < 100 || /json/i.test(res.headers.get('content-type') ?? ''))
        throw new TtsError('BreezeBlue 没有返回音频');
    return audio;
}
export async function inworldSpeak(s, text, doFetch = fetch) {
    const w = s.inworld;
    if (!w.key.trim())
        throw new TtsError('还没填 Inworld 的 Key');
    if (!w.voiceId.trim())
        throw new TtsError('还没填 Inworld 的音色 id');
    // Inworld 后台给的 Key 本身就是 Basic 用的 base64，不用再编码；有人会连 "Basic " 一起复制过来
    const key = w.key.trim().replace(/^Basic\s+/i, '');
    let res;
    try {
        res = await doFetch(INWORLD_URL, {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: 'Basic ' + key },
            body: JSON.stringify({
                text,
                voiceId: w.voiceId.trim(),
                modelId: w.model.trim() || 'inworld-tts-2-flash',
                audioConfig: { audioEncoding: 'MP3', ...(s.speed !== 100 ? { speakingRate: clamp(s.speed / 100, 0.5, 1.5) } : {}) },
            }),
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
    }
    catch (e) {
        throw new TtsError(netText(e));
    }
    if (!res.ok) {
        const detail = await errorDetail(res);
        throw new TtsError('Inworld 返回 HTTP ' + res.status + hintFor(res.status, false) + (detail ? '：' + detail : ''), res.status);
    }
    const json = await res.json();
    const audio = typeof json.audioContent === 'string' ? Buffer.from(json.audioContent, 'base64') : Buffer.alloc(0);
    if (audio.length < 100)
        throw new TtsError('Inworld 没有返回音频');
    return audio;
}
/** 念之前把文字收拾一下：去掉 [语音] 记号、Markdown 符号，按设置去掉括号里的动作描写。 */
export function speakableText(text, stripParens) {
    // **加粗** 先去掉记号，剩下单个星号包着的才是动作
    let t = text.replace(TAG_RE, '').replace(/\*\*/g, '');
    if (stripParens)
        t = t.replace(/（[^（）]*）|\([^()]*\)|\*[^*\n]+\*/g, '');
    return t.replace(/[*#`>_~]/g, '').replace(/[ \t]+/g, ' ').trim();
}
export function stripTags(text) {
    return text.replace(/(\[语音\]|【语音】)[ \t]*/g, '');
}
/** 这个会话能不能发语音。 */
export function ttsActive(s, kind) {
    if (!s.enabled)
        return false;
    return kind.group ? s.group : kind.adminPrivate ? s.adminPrivate : s.private;
}
/** 「她自己决定」模式下，每条消息附带的提示（告诉她怎么发语音）。 */
export function ttsHint(s) {
    return '想用语音说的话，在那一行开头写 ' + VOICE_TAG + '（一行一条语音，每条不超过 ' + s.maxChars + ' 字，只写要念出来的话，不写动作和表情）。'
        + '不是每句都要用语音，像平时发语音那样自然地用。';
}
/**
 * 把要发的几段（已经按分段设置拆好）标上哪段用语音。
 * tag 模式下没开分段时，也把 [语音] 开头的行单独拿出来（文字行连在一起还是一条）。
 */
export function planPieces(segments, s, active, random = Math.random) {
    if (!active)
        return segments.map(t => ({ text: stripTags(t).trim(), voice: false })).filter(p => p.text !== '');
    const out = [];
    if (s.mode === 'tag') {
        for (const seg of segments) {
            let buf = [];
            const flush = () => { const t = buf.join('\n').trim(); if (t)
                out.push({ text: t, voice: false }); buf = []; };
            for (const line of seg.split('\n')) {
                const m = /^\s*(\[语音\]|【语音】)\s*/.exec(line);
                if (m) {
                    flush();
                    const t = stripTags(line).trim();
                    if (t)
                        out.push({ text: t, voice: true });
                }
                else
                    buf.push(line);
            }
            flush();
        }
    }
    else {
        const on = s.mode === 'always' || random() * 100 < s.chance;
        for (const seg of segments) {
            const t = stripTags(seg).trim();
            if (t)
                out.push({ text: t, voice: on });
        }
    }
    // 太长的、念出来是空的（只有动作描写）不念
    return out.map(p => p.voice && (p.text.length > s.maxChars || speakableText(p.text, s.stripParens) === '') ? { ...p, voice: false } : p);
}
export class Tts {
    deps;
    today = { date: '', breeze: 0, inworld: 0, failed: 0, breezeChars: 0, inworldChars: 0 };
    lastError;
    lastFallback;
    constructor(deps) {
        this.deps = deps;
    }
    now() { return this.deps.now?.() ?? Date.now(); }
    status() {
        this.roll();
        return { today: { ...this.today }, ...(this.lastError ? { lastError: this.lastError } : {}), ...(this.lastFallback ? { lastFallback: this.lastFallback } : {}) };
    }
    roll() {
        const d = dayOf(this.now(), this.deps.settings().timezone);
        if (this.today.date !== d)
            this.today = { date: d, breeze: 0, inworld: 0, failed: 0, breezeChars: 0, inworldChars: 0 };
    }
    /** 合成一段语音：先 Breeze，不行 Inworld；都不行抛错。 */
    async speak(raw) {
        const s = this.deps.settings();
        const text = speakableText(raw, s.stripParens);
        if (text === '')
            throw new TtsError('没有要念的文字');
        this.roll();
        const start = this.now();
        const errors = [];
        if (s.breeze.key.trim() && s.breeze.voiceId.trim()) {
            try {
                const audio = await breezeSpeak(s, text, this.deps.fetch);
                this.today.breeze++;
                this.today.breezeChars += text.length;
                return { audio, provider: 'breeze', ms: this.now() - start };
            }
            catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                errors.push(msg);
                this.lastFallback = { at: this.now(), text: msg };
                this.deps.log(e instanceof TtsError && e.exhausted ? 'info' : 'warn', 'BreezeBlue 这一条没成功，改用 Inworld：' + msg);
            }
        }
        if (s.inworld.key.trim() && s.inworld.voiceId.trim()) {
            try {
                const audio = await inworldSpeak(s, text, this.deps.fetch);
                this.today.inworld++;
                this.today.inworldChars += text.length;
                return { audio, provider: 'inworld', ms: this.now() - start };
            }
            catch (e) {
                errors.push(e instanceof Error ? e.message : String(e));
            }
        }
        this.today.failed++;
        const msg = errors.length > 0 ? errors.join('；') : '两家的 Key 和音色 id 都没填全';
        this.lastError = { at: this.now(), text: msg };
        throw new TtsError(msg);
    }
}
/** 设置页「试听」：只用指定的那一家。 */
export async function testSpeak(s, provider, text, doFetch = fetch) {
    const start = Date.now();
    try {
        const t = speakableText(text, s.stripParens) || '你好呀，这是语音测试。';
        const audio = provider === 'breeze' ? await breezeSpeak(s, t, doFetch) : await inworldSpeak(s, t, doFetch);
        return { ok: true, ms: Date.now() - start, audio: audio.toString('base64') };
    }
    catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
}
function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }
function netText(e) {
    return e instanceof Error ? (e.name === 'TimeoutError' ? '连接超时' : '连不上：' + e.message) : String(e);
}
function hintFor(status, exhausted) {
    if (exhausted)
        return '（额度用完）';
    if (status === 401 || status === 403)
        return '（Key 不对或没有权限）';
    if (status === 404)
        return '（找不到这个音色，看看音色 id 和 Key 是不是同一个账号的）';
    if (status === 429)
        return '（请求太快，被限流）';
    return '';
}
async function errorDetail(res) {
    try {
        return (await res.text()).replace(/\s+/g, ' ').slice(0, 200);
    }
    catch {
        return '';
    }
}
/** 某个时区里的日期 YYYY-MM-DD */
export function dayOf(t, timezone) {
    try {
        return new Intl.DateTimeFormat('en-CA', { timeZone: timezone || 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(t);
    }
    catch {
        return new Date(t).toISOString().slice(0, 10);
    }
}
