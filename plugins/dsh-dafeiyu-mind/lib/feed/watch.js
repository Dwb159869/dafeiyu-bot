// 真"看"一整集：画面和台词分两路走，最后按时间码对齐。
// 设计参考 dsh-video-channel（MIT, AoNozomu）：按画面变化去重、台词建时间码索引、
// 要认人时回原片放大核对（小格只定位，认脸一定要放大，拿不准就问人）。
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { homedir } from 'node:os'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const REFERER = 'https://www.bilibili.com/'
const CRED = path.join(homedir(), '.bili-ai', 'credentials.json')

export const WATCH_DEFAULTS = {
  threshold: 0.3, // 画面变化阈值（ffmpeg scene）
  minGapSec: 1.2, // 两格间隔小于这个就并掉
  maxShots: 48, // 一场最多留多少格
  sheetCols: 4, // 联络表列数
  cellWidth: 320,
}

function ffmpegBin() {
  return process.env.FFMPEG || 'ffmpeg'
}

function creds() {
  try {
    const raw = JSON.parse(fs.readFileSync(CRED, 'utf8'))
    if (!raw.sessdata) return null
    return raw
  } catch {
    return null
  }
}

async function apiGet(url, headers) {
  const r = await fetch(url, { headers })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

/** 视频元信息 + 直链（720p，durl 形式）。没登录就只能拿低清或失败。 */
export async function videoSource(bvid) {
  const c = creds()
  if (c === null) return { ok: false, reason: '没登录 B 站（缺 ~/.bili-ai/credentials.json），看不到画面' }
  const H = {
    'user-agent': UA,
    referer: REFERER,
    cookie: `SESSDATA=${c.sessdata}; bili_jct=${c.bili_jct}; buvid3=${c.buvid3}`,
  }
  const view = await apiGet(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`, H)
  if (view.code !== 0) return { ok: false, reason: `拿不到视频信息（code=${view.code} ${view.message ?? ''}）` }
  const { cid, title, duration, owner } = view.data
  const p = await apiGet(
    `https://api.bilibili.com/x/player/playurl?bvid=${bvid}&cid=${cid}&qn=80&fnval=1&platform=pc&high_quality=1`,
    H,
  )
  const url = p.data?.durl?.[0]?.url
  if (!url) return { ok: false, reason: `没拿到直链（code=${p.code} ${p.message ?? ''}）`, title, duration }
  return { ok: true, url, cid, title, duration, owner: owner?.name ?? '', headers: { 'user-agent': UA, referer: REFERER } }
}

/** 流式下载到本地（不要 arrayBuffer：一集 720p 能到 1GB 峰值内存）。 */
export async function downloadVideo(url, outFile, headers = {}) {
  const r = await fetch(url, { headers: { ...headers, range: 'bytes=0-' } })
  if (!r.ok || r.body === null) throw new Error(`下载失败 HTTP ${r.status}`)
  const { pipeline } = await import('node:stream/promises')
  const { Readable } = await import('node:stream')
  await pipeline(Readable.fromWeb(r.body), fs.createWriteStream(outFile))
  return fs.statSync(outFile).size
}

/** 画面变化点：ffmpeg 空跑一遍 scene 过滤器，把 pts_time 抓出来。 */
export function sceneTimes(file, threshold = WATCH_DEFAULTS.threshold) {
  try {
    const out = execFileSync(
      ffmpegBin(),
      [
        '-hide_banner',
        '-i',
        file,
        '-vf',
        `select='gt(scene,${threshold})',metadata=print:file=-`,
        '-an',
        '-f',
        'null',
        '-',
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 32 * 1024 * 1024, timeout: 900000 },
    )
    const ts = [...out.matchAll(/pts_time:([0-9.]+)/g)].map((m) => Number(m[1]))
    return [...new Set(ts)].filter((t) => t > 0.2)
  } catch {
    return []
  }
}

/** 相邻太近的并掉（画面太像就少留一张），再按上限等距挑。 */
export function thinShots(times, { minGapSec = WATCH_DEFAULTS.minGapSec, maxShots = WATCH_DEFAULTS.maxShots } = {}) {
  const sorted = [...times].sort((a, b) => a - b)
  const kept = []
  for (const t of sorted) {
    if (kept.length === 0 || t - kept[kept.length - 1] >= minGapSec) kept.push(t)
  }
  if (kept.length <= maxShots) return kept
  const picked = []
  for (let i = 0; i < maxShots; i += 1) picked.push(kept[Math.round((i * (kept.length - 1)) / (maxShots - 1))])
  return [...new Set(picked)]
}

/** 抽单帧（回原片放大核对用）。 */
export function grabFrame(file, atSec, outFile) {
  execFileSync(
    ffmpegBin(),
    ['-hide_banner', '-loglevel', 'error', '-ss', String(Math.max(0, atSec)), '-i', file, '-frames:v', '1', '-q:v', '2', '-y', outFile],
    { stdio: ['ignore', 'ignore', 'pipe'], timeout: 120000 },
  )
  return fs.existsSync(outFile) ? outFile : ''
}

/** 一串时间点 → 一张带编号的联络表（小格只定位，不拿它认人）。 */
export function contactSheet(file, times, outFile, opts = {}) {
  const { sheetCols = WATCH_DEFAULTS.sheetCols, cellWidth = WATCH_DEFAULTS.cellWidth } = opts
  if (times.length === 0) return ''
  const dir = path.join(path.dirname(outFile), `.cells-${path.basename(outFile, '.jpg')}`)
  fs.mkdirSync(dir, { recursive: true })
  const cells = []
  times.forEach((t, i) => {
    const f = path.join(dir, `${String(i + 1).padStart(3, '0')}.jpg`)
    try {
      grabFrame(file, t, f)
      if (fs.existsSync(f)) cells.push(f)
    } catch {
      /* 抽不到就跳过这一格 */
    }
  })
  if (cells.length === 0) return ''
  const rows = Math.ceil(cells.length / sheetCols)
  const inputs = cells.flatMap((f) => ['-i', f])
  const filter = cells
    .map((_, i) => `[${i}:v]scale=${cellWidth}:-1,setsar=1[v${i}]`)
    .join(';')
    .concat(';', cells.map((_, i) => `[v${i}]`).join(''), `xstack=inputs=${cells.length}:layout=`)
  // xstack 的 layout 需要每格坐标，按行列算
  const layout = cells
    .map((_, i) => {
      const col = i % sheetCols
      const row = Math.floor(i / sheetCols)
      return `${col * cellWidth}_${row * Math.round(cellWidth * 0.5625)}`
    })
    .join('|')
  const fullFilter = filter + layout + ':fill=black[out]'
  try {
    execFileSync(
      ffmpegBin(),
      ['-hide_banner', '-loglevel', 'error', ...inputs, '-filter_complex', fullFilter, '-map', '[out]', '-q:v', '3', '-y', outFile],
      { stdio: ['ignore', 'ignore', 'pipe'], timeout: 300000 },
    )
  } catch {
    return ''
  }
  return fs.existsSync(outFile) ? outFile : ''
}

const clock = (s) => {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

/** 官方字幕 → [{t, text}]（bili-whale subtitles 输出形如 [00:12] 台词）。 */
export function parseSubtitle(text) {
  const lines = []
  for (const raw of String(text || '').split('\n')) {
    const m = /^\[(\d{1,2}):(\d{2})(?::(\d{2}))?\]\s*(.+)$/.exec(raw.trim())
    if (m === null) continue
    const t = m[3] !== undefined ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : Number(m[1]) * 60 + Number(m[2])
    lines.push({ t, text: m[4].trim() })
  }
  return lines
}

/** 字幕原文：subtitles 命令只打印前 12 行，正文在落盘的 TXT 里。 */
export function subtitleTextOf(bvid, cliResult = null) {
  const file = path.join(homedir(), '.dsh', 'shots', 'subs', `${bvid}-ai-zh.txt`)
  try {
    if (fs.existsSync(file)) {
      const txt = fs.readFileSync(file, 'utf8').trim()
      if (txt !== '') return txt
    }
  } catch {
    /* 读不到就退回 CLI 输出 */
  }
  return cliResult === null ? '' : `${cliResult.out}\n${cliResult.err}`
}

/** 台词时间码索引：合并同一句的重复行，按时间排。 */
export function subtitleIndex(lines) {
  const out = []
  for (const l of lines) {
    const prev = out[out.length - 1]
    if (prev !== undefined && prev.text === l.text) continue
    out.push(l)
  }
  return out
}

/** 两路对齐：每句台词落在第几格画面里。 */
export function alignTimeline(subs, shots) {
  return subs.map((s) => {
    let n = 0
    for (let i = 0; i < shots.length; i += 1) if (shots[i] <= s.t) n = i + 1
    return { ...s, shot: n }
  })
}

/** 整集摘要文案：给模型读的，不烧视觉 token。 */
export function digestOf({ title, duration, shots, subs, sheet, videoFile, cached }) {
  const head = [`《${title}》${clock(duration)}`]
  if (cached) head.push('（这集之前扫过，直接读缓存）')
  const shotLine =
    shots.length > 0
      ? `画面：${shots.length} 格（按变化去重，${shots.slice(0, 3).map(clock).join(' / ')} …）`
      : '画面：没抓到（下载或抽帧失败）'
  const subLine =
    subs.length > 0
      ? `台词：${subs.length} 句带时间码（${subs.slice(0, 2).map((s) => `${clock(s.t)} ${s.text}`).join('；')} …）`
      : '台词：没有官方字幕（要读画面里的字，用 mind_watch op=zoom 取那一格，再自己看）'
  const body = [head.join(' '), shotLine, subLine]
  if (sheet) body.push(`联络表：${sheet}（小格只定位，认人必须放大）`)
  if (videoFile) body.push(`原片：${videoFile}`)
  body.push('要看某句台词在哪：mind_watch op=where；要认人：mind_watch op=zoom 取那一帧再仔细看。')
  return body.join('\n')
}

/** 扫一整集：下载 → 画面变化点 → 联络表 → 台词索引 → 落盘。 */
export async function scanEpisode(bvid, { cacheDir, maxShots = WATCH_DEFAULTS.maxShots, threshold = WATCH_DEFAULTS.threshold, reuse = true } = {}) {
  const dir = cacheDir || path.join(homedir(), '.dsh', 'shots', 'watch')
  fs.mkdirSync(dir, { recursive: true })
  const indexFile = path.join(dir, `${bvid}.scan.json`)
  if (reuse && fs.existsSync(indexFile)) {
    try {
      const old = JSON.parse(fs.readFileSync(indexFile, 'utf8'))
      if (Array.isArray(old.shots) && old.shots.length > 0 && fs.existsSync(old.videoFile ?? '')) {
        return { ok: true, ...old, cached: true, text: digestOf({ ...old, cached: true }) }
      }
    } catch {
      /* 缓存坏了就重扫 */
    }
  }
  const src = await videoSource(bvid)
  if (!src.ok) return { ok: false, reason: src.reason }
  const videoFile = path.join(dir, `${bvid}.mp4`)
  if (!fs.existsSync(videoFile)) {
    try {
      await downloadVideo(src.url, videoFile, src.headers)
    } catch (e) {
      return { ok: false, reason: `下载失败：${e instanceof Error ? e.message : String(e)}` }
    }
  }
  let times = sceneTimes(videoFile, threshold)
  if (times.length === 0) {
    // 画面几乎不变的视频：退回等间隔
    const n = Math.min(maxShots, Math.max(6, Math.round(src.duration / 20)))
    times = Array.from({ length: n }, (_, i) => ((i + 0.5) * src.duration) / n)
  }
  const shots = thinShots(times, { maxShots })
  const sheet = contactSheet(videoFile, shots, path.join(dir, `${bvid}.sheet.jpg`))
  const subRaw = await import('./bili.js').then((m) => m.runCli(['subtitles', bvid], { timeoutMs: 60000 }))
  const subs = subtitleIndex(parseSubtitle(subtitleTextOf(bvid, subRaw)))
  const record = {
    bvid,
    title: src.title,
    duration: src.duration,
    shots,
    subs,
    sheet,
    videoFile,
    scannedAt: new Date().toISOString(),
  }
  try {
    fs.writeFileSync(indexFile, JSON.stringify(record, null, 2), 'utf8')
  } catch {
    /* 落盘失败不影响这次读 */
  }
  return { ok: true, ...record, cached: false, text: digestOf(record) }
}

/** 找一句台词在哪：返回时间码 + 落在第几格 + 可以放大的帧文件。 */
export function whereInVideo(record, query, { grab = true } = {}) {
  const q = String(query || '').trim()
  if (q === '') return { ok: false, reason: '要查什么台词？' }
  const hits = record.subs.filter((s) => s.text.includes(q)).slice(0, 8)
  if (hits.length === 0) return { ok: false, reason: `台词里没找到「${q}」（这集${record.subs.length === 0 ? '没有官方字幕' : `有 ${record.subs.length} 句`}）` }
  const out = hits.map((h) => {
    const shot = record.shots.filter((t) => t <= h.t).length
    const item = { t: h.t, text: h.text, shot }
    if (grab && record.videoFile && fs.existsSync(record.videoFile)) {
      const f = path.join(path.dirname(record.videoFile), `${record.bvid}-at-${Math.floor(h.t)}.jpg`)
      try {
        const got = grabFrame(record.videoFile, h.t, f)
        if (got) item.frame = got
      } catch {
        /* 抽不到就算 */
      }
    }
    return item
  })
  const text = out
    .map((h) => `${clock(h.t)}（${h.shot > 0 ? `第 ${h.shot} 格之后` : '开头那段'}）${h.text}${h.frame ? `\n  放大帧：${h.frame}` : ''}`)
    .join('\n')
  return { ok: true, hits: out, text: `${text}\n（认人一定要看放大帧，拿不准就问主人）` }
}

/** 取某一时刻的整帧，回原片放大核对。 */
export function zoomAt(record, atSec) {
  if (!record.videoFile || !fs.existsSync(record.videoFile)) return { ok: false, reason: '原片不在本地了，重新 scan 一次' }
  const t = Math.max(0, Math.min(Number(atSec) || 0, record.duration || 0))
  const f = path.join(path.dirname(record.videoFile), `${record.bvid}-at-${Math.floor(t)}.jpg`)
  const got = grabFrame(record.videoFile, t, f)
  if (got === '') return { ok: false, reason: '这一帧没抽出来' }
  return { ok: true, frame: got, text: `${clock(t)} 的整帧：${got}` }
}
