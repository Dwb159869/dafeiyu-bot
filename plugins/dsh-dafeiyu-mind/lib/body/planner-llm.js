// 日程生成：组提示词、叫模型、解析、失败兜底
// 参考 dsh-daily-schedule（MIT, aa1355721445-lgtm）的提示词结构与"不合格就修"的思路，按 mind 的 llm 调用方式重写。
import { makePlan, normalizeItems, parseClock, templateItems } from './planner.js'

const FIXED = [
  '硬要求：',
  '- 一天 00:00 到 24:00 都要有安排，段与段首尾相接，不许重叠、不许留空。',
  '- 6 到 20 段之间；吃饭、睡觉、通勤都要写进去，别跳过。',
  '- 每一段 activity 用第一人称能做的一件事，短句，别写"安排"、"计划"这种词。',
  '- 不许出现香菜、苦瓜、太辣的东西。',
  '- 睡觉时间按 23:40 前后，起床按 08:10 前后（休息日可以晚）。',
]

/** 最近几天做过什么，给模型参考（别天天一模一样） */
export function recentSummary(recent, n = 3) {
  const rows = Array.isArray(recent) ? recent.slice(0, n) : []
  const out = []
  for (const d of rows) {
    const items = d?.agenda?.items ?? []
    if (!items.length) continue
    const acts = items
      .filter((it) => !it.gap)
      .map((it) => it.activity ?? it.what)
      .slice(0, 8)
      .join('、')
    out.push(`${d.day}（${d.agenda?.typeName ?? '—'}）：${acts}`)
  }
  return out
}

export function buildPrompt({ persona = '', type, day, recent = [], wardrobe = [], hint = '', series = null }) {
  const parts = []
  if (persona) parts.push('【你这个人】\n' + String(persona).slice(0, 3500))
  parts.push(`【要排的日子】\n${day}，类型：${type?.name ?? '上班日'}`)
  if (type?.guide) parts.push('【这一天大概怎么过】\n' + type.guide)
  const rs = recentSummary(recent)
  if (rs.length) parts.push('【最近几天】\n' + rs.join('\n') + '\n（可以呼应，但别排成一模一样的一天）')
  if (series?.title) {
    parts.push(`【在追的剧】\n《${series.title}》已经看到第 ${series.ep ?? 1} 集（共 ${series.eps ?? '?'} 集），今天看的话就接着往下看。`)
  }
  if (wardrobe.length) parts.push('【衣柜和场景里有的】\n' + wardrobe.slice(0, 40).join('、') + '\n（在 detail 里写穿搭/场景时只能从这里挑，没有的别编）')
  if (hint) parts.push('【特别要求】\n' + String(hint).slice(0, 400))
  parts.push(FIXED.join('\n'))
  parts.push(
    [
      '只输出一个 JSON 对象，不要解释、不要 Markdown 围栏：',
      '{"title":"这一天的调子，6 字以内","mood":"整体心情，4 字以内","items":[{"start":"07:30","end":"08:10","activity":"起床洗漱、吃早饭","location":"家","detail":""}]}',
      'detail 可以空字符串；想写和谁在一起、吃什么、看什么就写在 detail 里。',
    ].join('\n'),
  )
  return parts.join('\n\n')
}

/** 从模型输出里抠出 JSON，不合格就抛错（由上层决定要不要重试） */
export function parsePlan(text) {
  let s = String(text ?? '').trim()
  if (!s) throw new Error('模型没吐东西')
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  const a = s.indexOf('{')
  const b = s.lastIndexOf('}')
  if (a < 0 || b <= a) throw new Error('模型输出里找不到 JSON')
  let obj
  try {
    obj = JSON.parse(s.slice(a, b + 1))
  } catch (e) {
    throw new Error('模型输出的 JSON 解析不了：' + (e instanceof Error ? e.message : String(e)))
  }
  const items = normalizeItems(obj.items).filter((it) => !it.gap)
  if (items.length < 4) throw new Error(`只排了 ${items.length} 段，太少了`)
  // 时段要首尾相接，补上缺口（normalizeItems 已经补，这里只要保证起点从 00:00 或第一段开始）
  return { title: String(obj.title ?? '').slice(0, 40), mood: String(obj.mood ?? '').slice(0, 30), items: normalizeItems(items) }
}

/** 叫一次模型，把文本攒起来 */
export async function askModel(ctx, { prompt, maxTokens = 8000, signal = null, route = null }) {
  const llm = typeof ctx?.get === 'function' ? ctx.get('llm') : null
  if (!llm || typeof llm.stream !== 'function') throw new Error('这台机器的模型服务没挂上')
  const r = route ?? defaultRoute(ctx)
  if (!r?.provider || !r?.model) throw new Error('不知道该用哪个模型')
  let text = ''
  const stream = llm.stream({
    provider: r.provider,
    model: r.model,
    maxTokens,
    messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
    ...(signal ? { signal } : {}),
  })
  for await (const chunk of stream) {
    if (chunk?.type === 'text-delta' && typeof chunk.text === 'string') text += chunk.text
    else if (chunk?.type === 'finish') {
      const kind = chunk.reason?.kind
      if (kind === 'error' || kind === 'aborted') throw new Error('模型调用中断了（' + kind + '）')
    }
  }
  return text
}

/** 当前默认模型（没有就返回 null） */
export function defaultRoute(ctx) {
  try {
    const svc = typeof ctx?.get === 'function' ? ctx.get('agentDefaultModel') : null
    if (svc && typeof svc.currentSelection === 'function') {
      const sel = svc.currentSelection()
      if (sel?.provider && sel?.model) return { provider: sel.provider, model: sel.model }
    }
  } catch {}
  return null
}

/**
 * 生成一天。失败就退回模板，绝不把"她今天没日程"抛给上层。
 * 返回 {plan, error?}
 */
export async function generateDay({ ctx, day, type, recent = [], wardrobe = [], hint = '', persona = '', series = null, signal = null }) {
  const prompt = buildPrompt({ persona, type, day, recent, wardrobe, hint, series })
  try {
    const text = await askModel(ctx, { prompt, signal })
    const parsed = parsePlan(text)
    const plan = makePlan({ day, type, items: parsed.items, title: parsed.title, mood: parsed.mood, source: 'llm', model: defaultRoute(ctx)?.model ?? '' })
    // 段数太少或者时间没铺满，用模板补一遍（保留模型写的段）
    const covered = plan.items.filter((it) => !it.gap).length
    if (covered < 4) throw new Error('段数不够')
    return { plan }
  } catch (e) {
    const plan = makePlan({ day, type, items: templateItems(type?.id), title: '', mood: '', source: 'template' })
    return { plan, error: e instanceof Error ? e.message : String(e) }
  }
}

/** 时段是不是合法（给工具校验用） */
export function validRange(start, end) {
  const s = parseClock(start)
  const e = parseClock(end)
  return s !== null && e !== null && e > s
}
