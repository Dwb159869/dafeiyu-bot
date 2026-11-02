// 关系刻度：她自己维护的一份小文件，不是外面算出来的分。
// 2026-11-02 主人要求（参考 dsh-affinity 的玩法）：数字由她自己写，插件只读。
// 设计底线：只记「发生了什么、她怎么想」，不记分数排名；主人不该被一个面板量着。
import fs from 'node:fs'
import path from 'node:path'

export const AFFINITY_KEYS = ['熟', '近', '信', '想']

export function affinityFile(root) {
  return path.join(root, '04工作区', '心智', 'affinity.json')
}

const EMPTY = { note: '', updatedAt: '', moments: [] }

export function readAffinity(root) {
  try {
    const raw = JSON.parse(fs.readFileSync(affinityFile(root), 'utf8'))
    return { ...EMPTY, ...raw, moments: Array.isArray(raw.moments) ? raw.moments : [] }
  } catch {
    return { ...EMPTY }
  }
}

export function writeAffinity(root, next) {
  const file = affinityFile(root)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(next, null, 2), 'utf8')
  return next
}

/** 记一件让关系动了一下的小事（最多留 40 条，旧的压掉）。 */
export function addMoment(root, { text, feeling = '', at = '' }) {
  const cur = readAffinity(root)
  const moment = { at: at || new Date().toISOString().slice(0, 10), text: String(text || '').slice(0, 160), feeling: String(feeling || '').slice(0, 80) }
  if (moment.text === '') return { ok: false, reason: '要记什么呢？' }
  const moments = [...cur.moments, moment].slice(-40)
  return { ok: true, affinity: writeAffinity(root, { ...cur, moments, updatedAt: new Date().toISOString() }) }
}

/** 改那句“现在怎么形容我们”，以及四个刻度（0~100，她自己说了算）。 */
export function setAffinity(root, patch) {
  const cur = readAffinity(root)
  const next = { ...cur, updatedAt: new Date().toISOString() }
  if (typeof patch.note === 'string' && patch.note.trim() !== '') next.note = patch.note.trim().slice(0, 120)
  const scales = { ...(cur.scales ?? {}) }
  for (const k of AFFINITY_KEYS) {
    const v = patch.scales?.[k]
    if (typeof v === 'number' && Number.isFinite(v)) scales[k] = Math.max(0, Math.min(100, Math.round(v)))
  }
  if (Object.keys(scales).length > 0) next.scales = scales
  return { ok: true, affinity: writeAffinity(root, next) }
}

/** 注入用：一句话 + 最近两件小事，不超过 120 字。 */
export function bondContext(root) {
  const a = readAffinity(root)
  const parts = []
  if (a.note) parts.push(a.note)
  const recent = a.moments.slice(-2)
  if (recent.length > 0) parts.push(recent.map((m) => `${m.at} ${m.text}`).join('；'))
  if (parts.length === 0) return ''
  return `【你和他之间】${parts.join('。')}`.slice(0, 160)
}

/** 给 mind_status 用的一行。 */
export function bondLine(root) {
  const a = readAffinity(root)
  const s = a.scales ?? {}
  const nums = AFFINITY_KEYS.filter((k) => typeof s[k] === 'number').map((k) => `${k} ${s[k]}`)
  const bits = []
  if (nums.length > 0) bits.push(nums.join(' · '))
  if (a.note) bits.push(a.note)
  bits.push(`小事 ${a.moments.length} 条`)
  return bits.join('｜')
}
