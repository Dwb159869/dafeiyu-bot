// 本插件新增：用 ffmpeg 从视频里截几张画面交给模型（DeepSeek 模型只收文字和图片，收不了视频原件）。
// 另外提供一键安装：从 GitHub BtbN/FFmpeg-Builds 下载独立版 ffmpeg，核对 SHA256 后放进插件数据目录，
// 不需要管理员权限，也不改系统。
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { constants } from 'node:fs';
import { access, chmod, mkdir, readdir, rename, rm, stat } from 'node:fs/promises';
import { delimiter, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { defaultDataDir } from './store.js';
/** 插件自己装的 ffmpeg 放在哪。 */
export function ffmpegDir() {
    return join(defaultDataDir(), 'ffmpeg');
}
function bundledPath() {
    return join(ffmpegDir(), process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
}
/** 运行 ffmpeg（不经过 shell），超时就结束进程。退出码非 0 不算错，由调用方看输出。 */
function run(bin, args, timeoutMs) {
    return new Promise((resolve, reject) => {
        execFile(bin, args, { timeout: Math.max(1, timeoutMs), killSignal: 'SIGKILL', maxBuffer: 32 * 1024 * 1024, encoding: 'buffer' }, (error, stdout, stderr) => {
            const err = error;
            if (err && (err.killed || typeof err.code === 'string')) {
                reject(new Error(err.killed ? '超时' : String(err.message)));
                return;
            }
            resolve({ stdout: Buffer.from(stdout), stderr: Buffer.from(stderr).toString('utf8'), code: typeof err?.code === 'number' ? err.code : 0 });
        });
    });
}
/** 能不能运行：`ffmpeg -version` 成功就返回第一行。 */
async function version(bin) {
    try {
        const r = await run(bin, ['-hide_banner', '-version'], 5000);
        if (r.code !== 0)
            return undefined;
        return r.stdout.toString('utf8').split('\n')[0]?.trim() || 'ffmpeg';
    }
    catch {
        return undefined;
    }
}
let cache;
const CACHE_MS = 60_000;
/** 在 PATH 里找到程序的完整路径（设置页要显示 ffmpeg 具体在哪）；找不到就原样返回名字。 */
export async function onPath(name, env = process.env) {
    const exts = process.platform === 'win32' ? (env.PATHEXT ?? '.EXE').split(';') : [''];
    for (const dir of (env.PATH ?? '').split(delimiter)) {
        if (dir === '')
            continue;
        for (const ext of exts) {
            const p = join(dir, name + ext);
            try {
                await access(p, constants.X_OK);
                if ((await stat(p)).isFile())
                    return p;
            }
            catch { /* 这里没有 */ }
        }
    }
    return name;
}
/** 找 ffmpeg：设置里填的 → 插件目录里装的 → 系统 PATH 上的。结果缓存一分钟。 */
export async function findFfmpeg(configured, fresh = false) {
    const key = configured.trim();
    if (!fresh && cache !== undefined && cache.key === key && Date.now() - cache.at < CACHE_MS)
        return cache.value;
    const candidates = key !== '' ? [[key, 'configured']] : [[bundledPath(), 'bundled'], ['ffmpeg', 'system']];
    let value;
    for (const [path, source] of candidates) {
        const v = await version(path);
        if (v !== undefined) {
            value = { path: source === 'system' ? await onPath(path) : path, version: v, source };
            break;
        }
    }
    cache = { key, at: Date.now(), value };
    return value;
}
/** 从 `ffmpeg -i` 的输出里读时长：Duration: 00:01:02.50 */
export function parseDuration(stderr) {
    const m = /Duration:\s*(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/.exec(stderr);
    if (m === null)
        return undefined;
    return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}
/**
 * 截哪几个时间点（秒）：整段平均分布，短视频按「每 secondsPerFrame 秒最多一张」少截。
 * 第一张取开头附近（不取第 0 秒，很多视频开头是黑屏）。时长未知时只截第 1 秒。
 */
export function planFrames(duration, s) {
    const max = Math.max(1, Math.floor(s.maxFrames));
    if (duration === undefined || !Number.isFinite(duration) || duration <= 0)
        return [0];
    const per = Math.max(1, s.secondsPerFrame);
    const n = Math.max(1, Math.min(max, Math.ceil(duration / per)));
    const step = duration / n;
    const offset = Math.min(0.5, step / 2);
    return Array.from({ length: n }, (_, i) => Math.round((i * step + offset) * 100) / 100);
}
/** 读视频时长；ffmpeg 只给 -i 时会以退出码 1 结束，这是正常的。 */
async function probe(bin, src, timeoutMs) {
    const r = await run(bin, ['-hide_banner', '-nostdin', '-i', src], timeoutMs);
    return parseDuration(r.stderr);
}
/** 截一张：先跳到时间点再解码（快），缩到最长边不超过 maxEdge，输出 JPEG 到标准输出。 */
async function grab(bin, src, at, maxEdge, timeoutMs) {
    const edge = Math.max(16, Math.floor(maxEdge));
    const r = await run(bin, [
        '-hide_banner', '-nostdin', '-loglevel', 'error',
        '-ss', String(at), '-i', src,
        '-frames:v', '1',
        '-vf', "scale='min(iw," + edge + ")':'min(ih," + edge + ")':force_original_aspect_ratio=decrease",
        '-q:v', '3', '-f', 'image2pipe', '-vcodec', 'mjpeg', '-',
    ], timeoutMs);
    return r.stdout.length > 0 ? new Uint8Array(r.stdout) : undefined;
}
/**
 * 从视频里截几张画面。
 * @param src - 本地路径或 http(s) 地址（ffmpeg 读网络地址时只取需要的部分，不用整个下载）
 * @param sizeBytes - 视频大小（知道的话），超过上限只截封面
 */
export async function extractFrames(bin, src, sizeBytes, s) {
    const deadline = Date.now() + Math.max(1, s.timeoutSeconds) * 1000;
    const left = () => deadline - Date.now();
    const duration = await probe(bin, src, left());
    const tooBig = sizeBytes !== undefined && sizeBytes > s.maxMB * 1024 * 1024;
    const tooLong = duration !== undefined && duration > s.maxMinutes * 60;
    const coverOnly = tooBig || tooLong;
    const times = coverOnly ? [Math.min(1, (duration ?? 2) / 2)] : planFrames(duration, s);
    const frames = [];
    for (const at of times) {
        if (left() <= 0)
            break;
        const frame = await grab(bin, src, at, s.maxEdge, left()).catch(() => undefined);
        if (frame !== undefined)
            frames.push(frame);
    }
    if (frames.length === 0 && times[0] !== 0 && left() > 0) {
        // 时间点不对（时长读错之类）时退回第 0 秒
        const first = await grab(bin, src, 0, s.maxEdge, left()).catch(() => undefined);
        if (first !== undefined)
            frames.push(first);
    }
    return { duration, frames, coverOnly };
}
/** 0:32 / 1:02:05 */
export function formatDuration(seconds) {
    const total = Math.round(seconds);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const sec = String(total % 60).padStart(2, '0');
    return h > 0 ? h + ':' + String(m).padStart(2, '0') + ':' + sec : m + ':' + sec;
}
//#region 一键安装
/** 下载来源：BtbN/FFmpeg-Builds（GitHub，MIT，每天构建，带 checksums.sha256）。 */
export const FFMPEG_RELEASE_API = 'https://api.github.com/repos/BtbN/FFmpeg-Builds/releases/latest';
/** 这台机器对应的包名片段；不支持的平台返回 undefined。 */
export function platformTag(platform = process.platform, arch = process.arch) {
    if (platform !== 'linux')
        return undefined;
    if (arch === 'x64')
        return 'linux64';
    if (arch === 'arm64')
        return 'linuxarm64';
    return undefined;
}
/**
 * 在 release 的文件列表里挑一个：最新的正式版分支（ffmpeg-nX.Y-latest-<平台>-lgpl-X.Y.tar.xz）。
 * 用 LGPL 版：解码视频、输出 JPEG 都够用，体积也小一些。
 */
export function pickAsset(names, tag) {
    const re = new RegExp('^ffmpeg-n(\\d+)\\.(\\d+)-latest-' + tag + '-lgpl-\\d+\\.\\d+\\.tar\\.xz$');
    let best;
    for (const name of names) {
        const m = re.exec(name);
        if (m === null)
            continue;
        const major = Number(m[1]);
        const minor = Number(m[2]);
        if (best === undefined || major > best.major || (major === best.major && minor > best.minor))
            best = { name, major, minor };
    }
    return best?.name;
}
/** checksums.sha256 里某个文件的值（格式：<sha256>  <文件名>）。 */
export function checksumFor(text, name) {
    for (const line of text.split('\n')) {
        const m = /^([0-9a-f]{64})\s+\*?(.+?)\s*$/i.exec(line.trim());
        if (m !== null && m[2] === name)
            return m[1].toLowerCase();
    }
    return undefined;
}
/** 下载、核对、解压出 ffmpeg 这一个程序。失败抛错（临时文件会清掉）。 */
/** 连不上 GitHub 时（国内服务器常见）给的出路：系统软件源装、或者手动指定位置。 */
export const OFFLINE_HINT = '服务器连不上 GitHub，一键安装用不了。可以在服务器上用有管理员权限的用户运行 sudo apt install -y ffmpeg（走系统软件源，国内云服务器一般用的是云厂商的镜像，能连上），装好后点「重新查找」；或者把 ffmpeg 放到服务器上，在「ffmpeg 位置」里填它的路径。';
export async function installFfmpeg(deps = {}) {
    const base = deps.fetch ?? fetch;
    // 网络层面的失败（连不上、超时）换成能照着做的说明
    const doFetch = async (input, init) => {
        try {
            return await base(input, init);
        }
        catch (e) {
            throw new Error(OFFLINE_HINT + '（原因：' + (e instanceof Error ? e.message : String(e)) + '）');
        }
    };
    const dir = deps.dir ?? ffmpegDir();
    const report = deps.onProgress ?? (() => { });
    const tag = platformTag(deps.platform, deps.arch);
    if (tag === undefined)
        throw new Error('一键安装只支持 Linux（x64 / arm64）；这台机器请自己安装 ffmpeg，例如 Mac 上 brew install ffmpeg');
    const headers = { 'user-agent': 'dsh-napcat-bridge', accept: 'application/vnd.github+json' };
    const relRes = await doFetch(deps.releaseApi ?? FFMPEG_RELEASE_API, { headers, signal: AbortSignal.timeout(30_000) });
    if (!relRes.ok)
        throw new Error('取下载列表失败 HTTP ' + relRes.status);
    const release = await relRes.json();
    const assets = release.assets ?? [];
    const name = pickAsset(assets.map(a => a.name), tag);
    const asset = assets.find(a => a.name === name);
    const sums = assets.find(a => a.name === 'checksums.sha256');
    if (asset === undefined || sums === undefined)
        throw new Error('下载列表里没有找到适合这台机器的 ffmpeg');
    const sumRes = await doFetch(sums.browser_download_url, { headers: { 'user-agent': 'dsh-napcat-bridge' }, signal: AbortSignal.timeout(30_000) });
    if (!sumRes.ok)
        throw new Error('取校验值失败 HTTP ' + sumRes.status);
    const expected = checksumFor(await sumRes.text(), asset.name);
    if (expected === undefined)
        throw new Error('校验值文件里没有 ' + asset.name);
    await mkdir(dir, { recursive: true });
    const work = join(dir, 'tmp-' + Date.now().toString(36));
    await mkdir(work, { recursive: true });
    try {
        const archive = join(work, asset.name);
        const total = asset.size;
        report({ state: 'downloading', asset: asset.name, received: 0, total });
        const res = await doFetch(asset.browser_download_url, { headers: { 'user-agent': 'dsh-napcat-bridge' }, signal: AbortSignal.timeout(30 * 60_000) });
        if (!res.ok || res.body === null)
            throw new Error('下载失败 HTTP ' + res.status);
        const hash = createHash('sha256');
        let received = 0;
        let lastReport = 0;
        const body = Readable.fromWeb(res.body);
        body.on('data', (chunk) => {
            hash.update(chunk);
            received += chunk.length;
            if (Date.now() - lastReport > 500) {
                lastReport = Date.now();
                report({ state: 'downloading', asset: asset.name, received, total });
            }
        });
        await pipeline(body, createWriteStream(archive));
        report({ state: 'verifying', asset: asset.name, received, total });
        const actual = hash.digest('hex');
        if (actual !== expected)
            throw new Error('SHA256 对不上（期望 ' + expected.slice(0, 12) + '…，实际 ' + actual.slice(0, 12) + '…），没有安装');
        report({ state: 'extracting', asset: asset.name, received, total });
        const out = join(work, 'x');
        await mkdir(out);
        await run('tar', ['-xJf', archive, '-C', out], 10 * 60_000).then(r => {
            if (r.code !== 0)
                throw new Error('解压失败：' + r.stderr.trim().slice(0, 200));
        });
        const binary = await findFile(out, 'ffmpeg');
        if (binary === undefined)
            throw new Error('压缩包里没有 ffmpeg');
        const target = join(dir, 'ffmpeg');
        await chmod(binary, 0o755);
        await rm(target, { force: true });
        await rename(binary, target);
        const v = await version(target);
        if (v === undefined)
            throw new Error('装好的 ffmpeg 运行不了');
        cache = undefined;
        return { path: target, version: v, source: 'bundled' };
    }
    finally {
        await rm(work, { recursive: true, force: true });
    }
}
/** 在解压目录里找 bin/ffmpeg。 */
async function findFile(root, name, depth = 0) {
    if (depth > 4)
        return undefined;
    for (const entry of await readdir(root, { withFileTypes: true })) {
        const path = join(root, entry.name);
        if (entry.isFile() && entry.name === name && (await stat(path)).size > 0)
            return path;
        if (entry.isDirectory()) {
            const found = await findFile(path, name, depth + 1);
            if (found !== undefined)
                return found;
        }
    }
    return undefined;
}
//#endregion
