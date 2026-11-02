// 日程注入：把今天的计划压成一段她看得懂的人话
// 设计参考 dsh-daily-schedule 的 inject.js（MIT, aa1355721445-lgtm）：只写"此刻/接下来/今天"，外加说话方式约束，
// 并且只在时段切换时才变化（护提示词缓存）。
import { clockText, findItem, parseClock } from './planner.js'

const VOICE = [
  '说话方式：这些是你自己的日子，不是任务清单。别念时间表，别说"按照日程""我的安排是""日程上写着"，也别一次汇报好几件事；',
  '只在自然的时候提一句（比如"刚吃完饭"、"等下要去看剧"），忙的时候可以短一点，累的时候可以懒得说。',
]

export function localMinutes(nowMs, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false })
  const parts = fmt.formatToParts(new Date(nowMs))
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0)
  return (h % 24) * 60 + m
}

export function localHour(nowMs, timeZone) {
  return Math.floor(localMinutes(nowMs, timeZone) / 60)
}

function span(it) {
  return `${it.start}-${it.end}`
}

function lineOf(it) {
  const bits = [it.activity ?? it.what]
  if (it.location) bits.push('在' + it.location)
  if (it.detail) bits.push(it.detail)
  if (it.outfit) bits.push('穿' + it.outfit)
  return bits.join('，')
}

/**
 * @param plan 当天计划 {day,typeName,title,mood,items}
 * @param opts {nowMs, timeZone, tomorrow, series}
 */
export function planContext(plan, opts = {}) {
  const { nowMs = Date.now(), timeZone = 'Asia/Shanghai', tomorrow = null, series = null } = opts
  const items = Array.isArray(plan?.items) ? plan.items : []
  if (!items.length) return ''
  const minute = localMinutes(nowMs, timeZone)
  const cur = findItem(items, minute)
  const later = items.filter((it) => !it.gap && parseClock(it.start) > minute).slice(0, 2)
  const done = items.filter((it) => it.done).slice(-3)
  const out = []
  const head = [`今天：${plan.typeName ?? ''}${plan.title ? '·' + plan.title : ''}${plan.mood ? '（心情' + plan.mood + '）' : ''}`]
  out.push(head.join(''))
  if (cur && !cur.gap) {
    const left = parseClock(cur.end) - minute
    out.push(`此刻：${lineOf(cur)}${left <= 15 ? '（快结束了）' : ''}`)
  } else if (cur?.gap) {
    out.push('此刻：空着，随便干点什么')
  }
  if (later.length) out.push('接下来：' + later.map((it) => `${it.start} ${it.activity}`).join('；'))
  if (done.length) out.push('今天已经做过：' + done.map((it) => it.activity).join('、'))
  if (series?.title) out.push(`在追的剧：《${series.title}》看到第 ${series.ep ?? 1} 集（共 ${series.eps ?? '?'} 集）`)
  // 傍晚预告明天：只在 19:00 之后、而且明天已经排好时提
  const hour = Math.floor(minute / 60)
  if (hour >= 19 && tomorrow?.typeName) {
    const first = (tomorrow.items ?? []).find((it) => !it.gap)
    out.push(`明天是${tomorrow.typeName}${first ? `，${first.start} 起${first.activity}` : ''}`)
  }
  out.push(VOICE.join(''))
  const text = out.filter(Boolean).join('\n')
  return text.length > 700 ? text.slice(0, 700) + '…' : text
}

/** 给工具看的清单（带序号和此刻标记） */
export function planList(plan, opts = {}) {
  const { nowMs = Date.now(), timeZone = 'Asia/Shanghai' } = opts
  const items = Array.isArray(plan?.items) ? plan.items : []
  const minute = localMinutes(nowMs, timeZone)
  const cur = findItem(items, minute)
  const lines = items
    .filter((it) => !it.gap)
    .map((it, i) => {
      const mark = it.done ? '√' : it.skipped ? '×' : ' '
      const here = cur && cur.id === it.id ? '  ← 现在' : ''
      const extra = [it.location, it.detail, it.outfit ? '穿' + it.outfit : ''].filter(Boolean).join('，')
      return `${mark} ${i + 1}. ${span(it)} ${it.activity}${extra ? '（' + extra + '）' : ''}${here}`
    })
  return lines
}

/** 一天的计划压成一行（给状态工具用） */
export function planOneLine(plan) {
  const items = Array.isArray(plan?.items) ? plan.items.filter((it) => !it.gap) : []
  return `${plan?.typeName ?? '—'}·${items.length} 段${plan?.source === 'template' ? '（模板）' : ''}`
}

export { clockText }
