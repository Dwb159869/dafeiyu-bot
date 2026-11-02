// 日程规划（形状与规则）
// 设计参考 dsh-daily-schedule（MIT, aa1355721445-lgtm）：日子类型、加权挑选、时段补空档、改一段时挤开相邻段。
// 这里按 mind 的库和注入方式重写，没有直接复制它的 store/http/runner。
//
// 一项的字段：
//   id       稳定 id（改的时候认它）
//   start/end HH:MM（end 可以是 24:00）
//   activity 在做什么（人话，一句话）
//   location 在哪
//   detail   可选的补充（和谁、吃什么、看什么）
//   outfit / scene / props / with  可选，跟 image-studio 的库对上时才有
//   done / skipped  她自己勾的
// 为了兼容旧读法，同时写 t=start、what=activity 两个别名。

export const DAY_SCOPES = ['weekday', 'weekend', 'any']
export const SCOPE_LABEL = { weekday: '工作日', weekend: '周末', any: '每天' }

export const DEFAULT_DAY_TYPES = [
  {
    id: 'workday',
    name: '上班日',
    enabled: true,
    weight: 5,
    days: 'weekday',
    guide:
      '常规上班日，两点一线：起床洗漱、通勤去上班，白天干活，中午吃午饭，傍晚下班通勤回家，晚上吃饭、有一点自己的时间，然后睡觉。',
  },
  {
    id: 'restday',
    name: '休息日',
    enabled: true,
    weight: 4,
    days: 'weekend',
    guide: '不上班，以待在家里为主：睡个懒觉，在家收拾、打游戏或看剧，出门散散步，去附近的餐馆好好吃一顿，晚上在家放松。',
  },
  {
    id: 'outing',
    name: '外出日',
    enabled: true,
    weight: 2,
    days: 'weekend',
    guide: '出门玩一整天：逛街、看展、去公园或海边、找好吃的店，傍晚或晚上才回家，回家时有点累但很满足。',
  },
  {
    id: 'homebody',
    name: '宅家日',
    enabled: true,
    weight: 1,
    days: 'any',
    guide: '哪儿也不想去，几乎一整天窝在家：睡到中午，点外卖，追剧打游戏，作息有点乱，晚上反而精神。工作日遇到这种日子就是请了假。',
  },
  {
    id: 'overtime',
    name: '加班日',
    enabled: true,
    weight: 1,
    days: 'weekday',
    guide: '活多的一天：照常上班，但一直忙到很晚，午饭晚饭都随便对付，回家已经很累，倒头就睡。',
  },
  {
    id: 'slacking',
    name: '摸鱼日',
    enabled: true,
    weight: 1,
    days: 'weekday',
    guide: '名义上在上班，实际上一直找机会摸鱼：开小差、刷手机、去茶水间找零食、假装很忙，但下班前会把要紧的事赶完。',
  },
]

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '')
const int = (v, min, max, d) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d
}

/** 00:00–24:00 的分钟数；非法返回 null */
export function parseClock(text) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(text ?? '').trim())
  if (!m) return null
  const h = Number(m[1])
  const mi = Number(m[2])
  if (h === 24 && mi === 0) return 1440
  if (h > 23 || mi > 59) return null
  return h * 60 + mi
}

export function clockText(minutes) {
  const m = Math.max(0, Math.min(1440, Math.round(minutes)))
  if (m === 1440) return '24:00'
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0')
}

export function normalizeDayTypes(list) {
  const src = Array.isArray(list) && list.length ? list : DEFAULT_DAY_TYPES
  const out = []
  const seen = new Set()
  for (const raw of src.slice(0, 30)) {
    if (!isObj(raw)) continue
    const name = str(raw.name, 20).trim()
    if (!name) continue
    let id = str(raw.id, 40).trim().replace(/[^\w-]/g, '') || `type-${out.length + 1}`
    while (seen.has(id)) id = `${id}-x`
    seen.add(id)
    out.push({
      id,
      name,
      enabled: raw.enabled !== false,
      weight: int(raw.weight, 0, 100, 1),
      days: DAY_SCOPES.includes(raw.days) ? raw.days : 'any',
      guide: str(raw.guide, 600),
    })
  }
  return out.length ? out : DEFAULT_DAY_TYPES
}

export function dayTypeById(types, id) {
  return normalizeDayTypes(types).find((t) => t.id === id) ?? null
}

function weekdayOf(day) {
  const [y, m, d] = String(day).split('-').map(Number)
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1)).getUTCDay()
}

function scopeMatches(scope, weekday) {
  if (scope === 'any') return true
  const weekend = weekday === 0 || weekday === 6
  return scope === 'weekend' ? weekend : !weekend
}

/** 按日期和权重挑一个日子类型（同一天稳定，不会刷新一次变一次） */
export function pickDayType(types, day, forcedId = '', rand = null) {
  const list = normalizeDayTypes(types).filter((t) => t.enabled)
  const forced = list.find((t) => t.id === forcedId)
  if (forced) return forced
  const wd = weekdayOf(day)
  const pool = list.filter((t) => scopeMatches(t.days, wd) && t.weight > 0)
  if (!pool.length) return list[0] ?? DEFAULT_DAY_TYPES[0]
  const total = pool.reduce((n, t) => n + t.weight, 0)
  const r = (typeof rand === 'function' ? rand() : seededRand(day)) * total
  let acc = 0
  for (const t of pool) {
    acc += t.weight
    if (r < acc) return t
  }
  return pool[pool.length - 1]
}

/** 日期当种子的小随机：同一天反复算结果一样 */
export function seededRand(seedText) {
  let h = 2166136261
  for (const ch of String(seedText)) {
    h ^= ch.charCodeAt(0)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 100000) / 100000
}

function cleanItem(raw, i) {
  if (!isObj(raw)) return null
  const start = parseClock(raw.start ?? raw.t)
  const end = parseClock(raw.end)
  const activity = str(raw.activity ?? raw.what, 80).trim()
  if (start === null || !activity) return null
  const stop = end !== null && end > start ? end : Math.min(1440, start + 60)
  const item = {
    id: str(raw.id, 24) || `i${i + 1}`,
    start: clockText(start),
    end: clockText(stop),
    activity,
    location: str(raw.location ?? raw.place, 40).trim(),
    detail: str(raw.detail, 200).trim(),
    t: clockText(start),
    what: activity,
  }
  for (const k of ['outfit', 'outfitNote', 'scene', 'props', 'with', 'situation']) {
    const v = str(raw[k], 60).trim()
    if (v) item[k] = v
  }
  if (raw.gap === true) item.gap = true
  if (raw.done === true) item.done = true
  if (raw.skipped === true) item.skipped = true
  return item
}

/** 排好序、去重叠、补齐 00:00–24:00 的空档，最多 40 段 */
export function normalizeItems(list) {
  const raw = Array.isArray(list) ? list : []
  const items = []
  for (let i = 0; i < raw.length; i++) {
    const it = cleanItem(raw[i], i)
    if (it) items.push(it)
  }
  items.sort((a, b) => parseClock(a.start) - parseClock(b.start))
  const out = []
  let cursor = 0
  for (const it of items.slice(0, 40)) {
    const s = parseClock(it.start)
    const e = parseClock(it.end)
    if (s < cursor) {
      if (e <= cursor) continue
      it.start = clockText(cursor)
      it.t = it.start
    }
    const s2 = parseClock(it.start)
    if (s2 > cursor) out.push({ id: `gap${out.length}`, start: clockText(cursor), end: clockText(s2), activity: '空档', location: '', detail: '', t: clockText(cursor), what: '空档', gap: true })
    out.push(it)
    cursor = parseClock(it.end)
  }
  if (cursor < 1440) {
    out.push({ id: 'gap-end', start: clockText(cursor), end: '24:00', activity: cursor === 0 ? '空档' : '休息', location: '', detail: '', t: clockText(cursor), what: cursor === 0 ? '空档' : '休息', gap: true })
  }
  return out.slice(0, 40)
}

/** 此刻在做什么（按分钟） */
export function findItem(items, minute) {
  const list = Array.isArray(items) ? items : []
  for (const it of list) {
    const s = parseClock(it.start)
    const e = parseClock(it.end)
    if (s === null || e === null) continue
    if (minute >= s && minute < e) return it
  }
  return null
}

/**
 * 改一段，或者插一段：
 *   给了 id / index  → 改那一段（可以只改字段，也可以改时间并挤开邻居）
 *   没给 id / index  → 插入新的一段（时间重叠的邻居会被截断或让位）
 */
export function applyChange(items, change) {
  const list = Array.isArray(items) ? items.map((x) => ({ ...x })) : []
  const c = isObj(change) ? change : {}
  const hasTarget = c.id !== undefined || c.index !== undefined
  const targetIdx = hasTarget
    ? c.id !== undefined
      ? list.findIndex((x) => x.id === c.id)
      : Math.round(Number(c.index)) - 1
    : -1
  if (hasTarget && !(targetIdx >= 0 && targetIdx < list.length)) throw new Error('找不到要改的那一段')
  const target = hasTarget ? list[targetIdx] : null
  const start = parseClock(c.start ?? target?.start)
  const end = parseClock(c.end ?? target?.end)
  if (start === null || end === null || end <= start) throw new Error('start / end 要是 HH:MM，而且 end 要晚于 start')
  const next = {
    ...(target ?? {}),
    id: target?.id ?? `n${Date.now().toString(36).slice(-5)}`,
    start: clockText(start),
    end: clockText(end),
    t: clockText(start),
    activity: str(c.activity ?? c.what ?? target?.activity, 80).trim() || target?.activity || '（空）',
    location: str(c.location ?? target?.location, 40).trim(),
    detail: str(c.detail ?? target?.detail, 200).trim(),
  }
  next.what = next.activity
  for (const k of ['outfit', 'outfitNote', 'scene', 'props', 'with']) {
    if (c[k] !== undefined) {
      const v = str(c[k], 60).trim()
      if (v) next[k] = v
      else delete next[k]
    }
  }
  const rest = hasTarget ? list.filter((_, i) => i !== targetIdx) : list
  const kept = []
  for (const it of rest) {
    const s = parseClock(it.start)
    const e = parseClock(it.end)
    if (s === null || e === null) continue
    if (e <= start || s >= end) {
      kept.push(it)
      continue
    }
    // 被压到：完全被盖住的丢掉，两边留头留尾
    if (s < start) kept.push({ ...it, end: clockText(start), t: it.start, what: it.activity })
    if (e > end) kept.push({ ...it, id: it.id + 'b', start: clockText(end), t: clockText(end) })
  }
  kept.push(next)
  return normalizeItems(kept)
}

const TYPE_TEMPLATES = {
  workday: [
    ['07:30', '08:10', '起床洗漱、吃早饭', '家'],
    ['08:10', '08:50', '通勤去上班', '路上'],
    ['08:50', '12:00', '干活', '工位'],
    ['12:00', '13:00', '吃午饭', '公司附近'],
    ['13:00', '18:00', '接着干活，偶尔摸鱼', '工位'],
    ['18:00', '18:40', '下班回家', '路上'],
    ['18:40', '19:30', '吃晚饭', '家'],
    ['19:30', '21:30', '自己的时间，追剧或打游戏', '家'],
    ['21:30', '22:30', '洗漱、刷手机', '家'],
    ['22:30', '24:00', '睡觉', '家'],
  ],
  restday: [
    ['09:30', '10:20', '睡个懒觉再起', '家'],
    ['10:20', '11:00', '吃早饭', '家'],
    ['11:00', '13:00', '收拾屋子、洗衣服', '家'],
    ['13:00', '14:00', '吃午饭', '家'],
    ['14:00', '17:00', '看剧、打游戏', '家'],
    ['17:00', '18:00', '出门散步', '附近'],
    ['18:00', '19:30', '在外面好好吃一顿', '附近'],
    ['19:30', '22:00', '回家放松，接着看剧', '家'],
    ['22:00', '24:00', '洗漱睡觉', '家'],
  ],
  outing: [
    ['09:00', '09:40', '起床吃早饭', '家'],
    ['09:40', '11:00', '出门，坐车去目的地', '路上'],
    ['11:00', '13:00', '逛街、看展', '外面'],
    ['13:00', '14:00', '找家店吃饭', '外面'],
    ['14:00', '17:30', '继续逛，找个地方坐一会儿', '外面'],
    ['17:30', '19:00', '吃晚饭', '外面'],
    ['19:00', '20:30', '回家', '路上'],
    ['20:30', '22:30', '回家瘫着', '家'],
    ['22:30', '24:00', '睡觉', '家'],
  ],
  homebody: [
    ['11:30', '12:10', '睡到中午才起', '家'],
    ['12:10', '13:00', '点外卖吃', '家'],
    ['13:00', '16:00', '窝着看剧', '家'],
    ['16:00', '17:00', '打游戏', '家'],
    ['17:00', '18:30', '随便弄点吃的', '家'],
    ['18:30', '21:00', '接着看剧，一集接一集', '家'],
    ['21:00', '23:30', '刷手机、听歌', '家'],
    ['23:30', '24:00', '熬夜', '家'],
  ],
  overtime: [
    ['07:30', '08:10', '起床洗漱、吃早饭', '家'],
    ['08:10', '08:50', '通勤去上班', '路上'],
    ['08:50', '12:30', '一直忙', '工位'],
    ['12:30', '13:10', '随便吃口饭', '公司附近'],
    ['13:10', '19:30', '接着忙，活干不完', '工位'],
    ['19:30', '20:10', '晚饭对付一下', '公司附近'],
    ['20:10', '23:00', '加班', '工位'],
    ['23:00', '23:40', '回家', '路上'],
    ['23:40', '24:00', '倒头就睡', '家'],
  ],
  slacking: [
    ['08:00', '08:40', '起床洗漱、吃早饭', '家'],
    ['08:40', '09:10', '通勤去上班', '路上'],
    ['09:10', '11:00', '假装很忙，其实在摸鱼', '工位'],
    ['11:00', '11:20', '去茶水间找零食', '公司'],
    ['11:20', '12:00', '刷手机', '工位'],
    ['12:00', '13:00', '吃午饭', '公司附近'],
    ['13:00', '17:30', '开小差、混时间', '工位'],
    ['17:30', '18:10', '下班回家', '路上'],
    ['18:10', '19:30', '吃晚饭', '家'],
    ['19:30', '22:00', '自己的时间', '家'],
    ['22:00', '24:00', '洗漱睡觉', '家'],
  ],
}

/** 模型不可用时按类型给一套模板 */
export function templateItems(typeId) {
  const rows = TYPE_TEMPLATES[typeId] ?? TYPE_TEMPLATES.workday
  return normalizeItems(
    rows.map(([start, end, activity, location], i) => ({ id: `t${i + 1}`, start, end, activity, location })),
  )
}

/** 一天的壳：{day, typeId, typeName, title, mood, items, source, model, madeAt} */
export function makePlan({ day, type, items, title = '', mood = '', source = 'llm', model = '' }) {
  return {
    day,
    typeId: type?.id ?? 'workday',
    typeName: type?.name ?? '上班日',
    title: str(title, 40).trim(),
    mood: str(mood, 30).trim(),
    items: normalizeItems(items),
    source,
    model: str(model, 80),
    madeAt: Date.now(),
  }
}

export function planItems(plan) {
  const items = plan?.items
  return Array.isArray(items) ? items : []
}
