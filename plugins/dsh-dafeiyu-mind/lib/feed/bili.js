// 取稿：调用 vendor 里的 bili-whale CLI（唯一一套 B 站读取实现）
// 字幕优先（省），没有再用 debrief 一条龙；抽帧按需
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
export const VENDOR = path.resolve(here, '../../vendor/bili-whale')
export const CLI = path.join(VENDOR, 'tools', 'bili.mjs')

export function runCli(args, { timeoutMs = 90000, cwd = VENDOR } = {}) {
  const r = spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 12 * 1024 * 1024,
  })
  return { code: r.status ?? -1, out: r.stdout || '', err: r.stderr || '', signal: r.signal }
}

export function deps() {
  const r = runCli(['deps'], { timeoutMs: 60000 })
  return { ok: r.code === 0, text: (r.out + r.err).slice(0, 4000) }
}

function estimateTokens(text) {
  return Math.ceil(Buffer.byteLength(String(text || ''), 'utf8') / 3)
}

// 字幕压缩：整段字幕原样塞进上下文太贵（一小时视频 3~5 万 token），
// 按时间轴等距抽样保留骨架，原文落盘，需要细节再 read。
export function compressSubtitle(text, { limitTokens = 2500 } = {}) {
  const lines = String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '')
  if (lines.length === 0) return { text: '', kept: 0, total: 0, dropped: 0 }
  const total = lines.length
  if (estimateTokens(lines.join('\n')) <= limitTokens) {
    return { text: lines.join('\n'), kept: total, total, dropped: 0 }
  }
  const head = lines.slice(0, 8)
  const tail = lines.slice(-6)
  const middle = lines.slice(8, Math.max(8, total - 6))
  const sample = middle.length > 0 ? middle.slice(0, Math.min(50, middle.length)) : lines
  const perLine = Math.max(4, estimateTokens(sample.join('\n')) / sample.length)
  const budgetLines = Math.max(12, Math.floor(limitTokens / perLine))
  const room = Math.max(0, budgetLines - head.length - tail.length)
  const picked = []
  if (middle.length > 0 && room > 0) {
    const step = Math.max(1, Math.ceil(middle.length / room))
    for (let i = 0; i < middle.length && picked.length < room; i += step) picked.push(middle[i])
  }
  const kept = [...head, ...picked, ...tail]
  const out = kept.join('\n')
  return { text: out, kept: kept.length, total, dropped: total - kept.length }
}

// 读一条视频：先字幕，再 debrief
export function readVideo(bvid, { frames = false, timeoutMs = 120000, cacheDir = '', subtitleTokens = 2500 } = {}) {
  if (!/^BV[0-9A-Za-z]{8,12}$/.test(String(bvid || ''))) {
    return { ok: false, reason: `不认识的 BV 号：${bvid}` }
  }
  const sub = runCli(['subtitles', bvid], { timeoutMs: 60000 })
  const subText = `${sub.out}\n${sub.err}`
  const hasSub = sub.code === 0 && !/✗|没有|无字幕|未找到|失败/.test(subText.slice(0, 400)) && subText.trim().length > 200
  if (hasSub) {
    const full = subText.trim()
    const cap = compressSubtitle(full, { limitTokens: subtitleTokens })
    let text = cap.text
    let cacheFile = ''
    if (cap.dropped > 0 && cacheDir !== '') {
      try {
        fs.mkdirSync(cacheDir, { recursive: true })
        cacheFile = path.join(cacheDir, `${bvid}.txt`)
        fs.writeFileSync(cacheFile, full, 'utf8')
        text += `\n（字幕 ${cap.total} 行，压到 ${cap.kept} 行；原文在取稿缓存 ${bvid}.txt，要看细节再 read）`
      } catch {
        cacheFile = ''
      }
    }
    return { ok: true, kind: 'subtitle', text, tokens: estimateTokens(text), frames: 0, cacheFile, dropped: cap.dropped }
  }
  const args = ['debrief', bvid, '--no-frames']
  if (frames) args.splice(2, 1) // 去掉 --no-frames
  const r = runCli(args, { timeoutMs })
  const text = `${r.out}\n${r.err}`.trim()
  if (r.code !== 0 || text.length < 80) {
    // CLI 失败时会把整段安全提醒也打出来，只留真正有用的最后几行
    const tail = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l !== '')
      .slice(-6)
      .join('\n')
      .slice(0, 400)
    return { ok: false, reason: `取稿失败（exit ${r.code}）：${tail || '没有输出'}` }
  }
  return { ok: true, kind: frames ? 'debrief+frames' : 'debrief', text, tokens: estimateTokens(text), frames: frames ? 1 : 0 }
}

export function candidates(n = 4) {
  const r = runCli(['feed', '--n', String(n)], { timeoutMs: 90000 })
  const text = `${r.out}\n${r.err}`.trim()
  const bvs = [...new Set((text.match(/BV[0-9A-Za-z]{10}/g) || []))]
  return { ok: r.code === 0 && bvs.length > 0, bvs: bvs.slice(0, n), text }
}
