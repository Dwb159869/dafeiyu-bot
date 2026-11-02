// 语音转文字（AstrBot provider_stt_settings 的对应功能）。
// 两种方式：
//   command：运行一条本机命令（如 sherpa-onnx），命令里的 {file} 换成语音文件路径，标准输出就是文字；
//   openai：调 OpenAI 兼容的 /audio/transcriptions 接口（如硅基流动的 SenseVoice）。
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const TIMEOUT_MS = 60_000;
const MAX_BYTES = 25 * 1024 * 1024;
/** 取语音字节：先让 NapCat 转成 wav（get_record），不行再按 url 下载。 */
async function loadRecord(comp, callAction) {
    const file = String(comp.file || '');
    if (file !== '') {
        for (const format of ['wav', 'mp3']) {
            try {
                const ret = await callAction('get_record', { file, out_format: format });
                if (ret?.base64)
                    return { bytes: Buffer.from(String(ret.base64), 'base64'), ext: format };
                if (ret?.file) {
                    const path = String(ret.file).startsWith('file://') ? fileURLToPath(String(ret.file)) : String(ret.file);
                    return { bytes: await readFile(path), ext: format };
                }
            }
            catch {
                // 换一种格式或改用 url
            }
        }
    }
    const url = String(comp.url || '');
    if (url.startsWith('http://') || url.startsWith('https://')) {
        const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (!res.ok)
            throw new Error('下载语音失败 HTTP ' + res.status);
        return { bytes: new Uint8Array(await res.arrayBuffer()), ext: 'amr' };
    }
    throw new Error('取不到语音文件');
}
function runCommand(template, path) {
    // 按空白拆参数（不经过 shell），{file} 换成路径
    const parts = template.trim().split(/\s+/).map(p => p.replaceAll('{file}', path));
    if (!template.includes('{file}'))
        parts.push(path);
    const [cmd, ...args] = parts;
    return new Promise((resolve, reject) => {
        execFile(cmd, args, { timeout: TIMEOUT_MS, maxBuffer: 1024 * 1024 }, (error, stdout) => {
            if (error)
                reject(error);
            else
                resolve(String(stdout));
        });
    });
}
async function callOpenAI(s, bytes, ext) {
    const form = new FormData();
    form.append('model', s.model);
    form.append('file', new Blob([bytes]), 'voice.' + ext);
    const url = s.apiUrl.replace(/\/+$/, '') + '/audio/transcriptions';
    const res = await fetch(url, {
        method: 'POST',
        headers: s.apiKey ? { authorization: 'Bearer ' + s.apiKey } : {},
        body: form,
        signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
        let detail = '';
        try {
            detail = (await res.text()).slice(0, 200);
        }
        catch { /* 读不到就算了 */ }
        throw new Error('转写接口返回 HTTP ' + res.status + (detail ? '：' + detail : ''));
    }
    const json = await res.json();
    return String(json.text ?? '');
}
/** 一段静音的 wav（16kHz、单声道、16 位），测试用。 */
export function silentWav(ms = 1000) {
    const samples = Math.round(16 * ms);
    const data = samples * 2;
    const b = Buffer.alloc(44 + data);
    b.write('RIFF', 0);
    b.writeUInt32LE(36 + data, 4);
    b.write('WAVE', 8);
    b.write('fmt ', 12);
    b.writeUInt32LE(16, 16);
    b.writeUInt16LE(1, 20);
    b.writeUInt16LE(1, 22);
    b.writeUInt32LE(16000, 24);
    b.writeUInt32LE(32000, 28);
    b.writeUInt16LE(2, 32);
    b.writeUInt16LE(16, 34);
    b.write('data', 36);
    b.writeUInt32LE(data, 40);
    return new Uint8Array(b);
}
/** 设置页「测试」：拿一段静音试一下当前的语音转文字设置能不能用。 */
export async function testStt(s) {
    const start = Date.now();
    try {
        if (s.mode === 'off')
            return { ok: false, error: '语音转文字关着' };
        if (s.mode === 'openai') {
            if (s.apiUrl.trim() === '')
                return { ok: false, error: '还没填接口地址' };
            if (s.model.trim() === '')
                return { ok: false, error: '还没填模型' };
            const text = (await callOpenAI(s, silentWav(), 'wav')).trim();
            return { ok: true, ms: Date.now() - start, text };
        }
        if (s.command.trim() === '')
            return { ok: false, error: '还没填命令' };
        const dir = await mkdtemp(join(tmpdir(), 'napcat-stt-test-'));
        try {
            const path = join(dir, 'test.wav');
            await writeFile(path, silentWav());
            const text = (await runCommand(s.command, path)).trim();
            return { ok: true, ms: Date.now() - start, text };
        }
        finally {
            await rm(dir, { recursive: true, force: true });
        }
    }
    catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
}
/** 把一段语音转成文字；失败抛错。 */
export async function transcribe(comp, s, callAction) {
    const { bytes, ext } = await loadRecord(comp, callAction);
    if (bytes.length > MAX_BYTES)
        throw new Error('语音太大 ' + bytes.length);
    if (s.mode === 'openai')
        return (await callOpenAI(s, bytes, ext)).trim();
    const dir = await mkdtemp(join(tmpdir(), 'napcat-stt-'));
    try {
        const path = join(dir, 'voice.' + ext);
        await writeFile(path, bytes);
        return (await runCommand(s.command, path)).trim();
    }
    finally {
        await rm(dir, { recursive: true, force: true });
    }
}
