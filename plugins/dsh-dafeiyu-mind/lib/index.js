console.log('[dafeiyu-mind] module loaded')
// 大肥鱼心智层（合并版）
// 把原来的 life / bili-whale / bili-humanism 三家收成一个插件：
//   一个库（mind.db）· 一个时钟（60s tick）· 一个发言闸门（canSpeak）· 一套工具面
// 能力来源：
//   body/  ← dsh-dafeiyu-life（自研，MIT）
//   feed/  ← dsh-bili-whale（MIT, Alterssss）经 vendor/ 调用，不再重复实现取稿
//   mind/  ← dsh-bili-humanism 的证据手账与 human-world 设计（MIT, InariNGT-Ofiicial）
// 详见 NOTICE.md
import path from 'node:path'
import { readFileSync } from 'node:fs'
import { defineTool } from '@deepseek-ai/dsh-tools'
import z from '@deepseek-ai/schemastery'
import { MOOD_KINDS, advance, applyEvent, describe, localMinutes, initialState, verbose } from './body/engine.js'
import { moodText, readExternalMood } from './body/mood-bridge.js'
import { SERIES_POOL, composeDream, dreamContext, localDay, seriesLine } from './body/agenda.js'
import { DEFAULT_DAY_TYPES, applyChange, dayTypeById, findItem, makePlan, normalizeItems, parseClock, pickDayType, templateItems } from './body/planner.js'
import { generateDay } from './body/planner-llm.js'
import { localMinutes as planMinutes, planContext, planList, planOneLine } from './body/plan-inject.js'
import { linkItems, loadWardrobe, wardrobePrompt } from './body/wardrobe.js'
import { buildCandidates, buildProactivePrompt, blockedBy } from './speak/proactive.js'
import { MindDB } from './core/db.js'
import { canSpeak, inQuiet } from './core/gate.js'
import { DEFAULT_BUDGET, canRead, clampTokens, remaining } from './core/budget.js'
import { journalId, indexLine, writeJournal } from './mind/journal.js'
import { SELF_MAX_PER_DAY, appendSelf, selfContext } from './mind/self.js'
import { BreatheTracker } from './mind/breathe.js'
import { SOUL_SECTIONS, appendSoulLine, ensureSoul, readSoul, soulContext } from './mind/soul.js'
import { candidates as feedCandidates, deps as feedDeps, readVideo } from './feed/bili.js'
import { scanEpisode, whereInVideo, zoomAt } from './feed/watch.js'
import { AFFINITY_KEYS, addMoment, bondContext, bondLine, readAffinity, setAffinity } from './mind/affinity.js'

export const name = 'dafeiyu-mind'
export const inject = ['tools']

export const Config = z.object({
  root: z.string().default('/home/example/dafeiyu-linux/大肥鱼小窝').description('小窝根目录，mind.db 放在 04工作区/心智 下'),
  owners: z.array(z.string()).default([]).description('主人 QQ 号'),
  timeZone: z.string().default('Asia/Shanghai').description('按哪个时区判断作息'),
  sleepStart: z.string().default('23:40').description('几点开始睡'),
  sleepEnd: z.string().default('08:10').description('几点醒'),
  presets: z.array(z.string()).default(['companion']).description('只给这些预设的会话注入心智状态'),
  intervalSeconds: z.number().default(60).description('多久推进一次（秒）'),
  features: z
    .object({
      body: z.boolean().default(true),
      feed: z.boolean().default(true),
      journal: z.boolean().default(true),
      self: z.boolean().default(true),
      speak: z.boolean().default(true),
    })
    .description('分模块开关，全关就是空壳'),
  feedStart: z.string().default('20:00').description('晚上几点开始刷 B 站'),
  feedEnd: z.string().default('24:00').description('几点收工'),
  feedAutoRead: z.number().default(1).description('每个晚上自动精读几条（0=不自动读）'),
  requestsPerDay: z.number().default(DEFAULT_BUDGET.requestsPerDay),
  readsPerDay: z.number().default(DEFAULT_BUDGET.readsPerDay),
  tokensPerDay: z.number().default(DEFAULT_BUDGET.tokensPerDay),
  proactiveEnabled: z.boolean().default(true).description('主动消息'),
  breatheEnabled: z.boolean().default(true).description('换气：同一个工具同样参数连跑时提醒她先停一下'),
  breatheThreshold: z.number().default(3),
  breatheWindowMinutes: z.number().default(15),
  proactiveMinGapMinutes: z.number().default(90),
  proactiveRecentMinutes: z.number().default(40),
  proactiveCapPerDay: z.number().default(4),
  proactiveKindCooldownHours: z.number().default(6),
  proactivePrivate: z.boolean().default(false),
  proactiveGroup: z.boolean().default(false),
  proactiveActiveDays: z.number().default(7),
  quietStart: z.string().default('01:00'),
  quietEnd: z.string().default('09:00'),
  mentionCapPerDay: z.number().default(1).description('B 站内容值得分享时，一天最多 @ 几次'),
  shareEnabled: z.boolean().default(true).description('能不能把 B 站上看到的东西分享给主人（走 QQ）'),
  shareCapPerDay: z.number().default(2).description('一天最多分享几次'),
  commentEnabled: z.boolean().default(false).description('要不要在 B 站评论区发言（默认不要）'),
  planEnabled: z.boolean().default(true).description('用模型排她自己的日程（关掉就退回模板）'),
  planHour: z.string().default('22:00').description('晚上几点开始排第二天的日程'),
  planHint: z.string().default('').description('排日程时额外给模型的要求（可空）'),
  personaFile: z.string().default('/home/example/.dsh/companion/persona/persona.md').description('排日程时参考的人格文件'),
  wardrobeDir: z.string().default('').description('image-studio 的库目录，留空就用 ~/.dsh/image-studio/library'),
  injectScope: z.string().default('all').description('日程注入范围：all=所有陪伴会话，session=按会话开关'),
})

const RESULT = {
  type: 'object',
  additionalProperties: false,
  properties: { ok: { type: 'boolean', required: true }, message: { type: 'string', required: true } },
}
const render = (_a, v) => [{ type: 'text', text: String(v.message ?? '') }]
const errText = (e) => (e instanceof Error ? e.message : String(e))

function wrap(def) {
  const inner = def.execute
  def.execute = async (args, exec) => {
    try {
      return await inner(args, exec)
    } catch (e) {
      return { ok: false, message: '出错了：' + errText(e) }
    }
  }
  return def
}

export function apply(ctx, config) {
  console.log('[dafeiyu-mind] apply start')
  const log = (level, text) => {
    try {
      ctx.logger(level)('[dafeiyu-mind] ' + text)
    } catch {}
  }
  const settings = { timeZone: config.timeZone, sleepStart: config.sleepStart, sleepEnd: config.sleepEnd }
  const budget = { requestsPerDay: config.requestsPerDay, readsPerDay: config.readsPerDay, tokensPerDay: config.tokensPerDay }
  const dbFile = path.join(config.root, '04工作区', '心智', 'mind.db')
  const db = new MindDB(dbFile)
  const breathe = new BreatheTracker({
    enabled: config.breatheEnabled !== false,
    threshold: Math.max(2, Number(config.breatheThreshold) || 3),
    windowMs: Math.max(1, Number(config.breatheWindowMinutes) || 15) * 60000,
  })
  try { ensureSoul(config.root) } catch { /* 没权限就算了 */ }
  const dayOf = (now = Date.now()) => localDay(now, config.timeZone)
  const presetOf = (session) => String(session?.header?.agentPreset ?? session?.meta?.agentPreset ?? session?.agentPreset ?? '')
  const sessionKey = (session) => String(session?.id ?? session?.header?.id ?? session?.meta?.id ?? '')
  const injectAllowed = (session) => {
    if (String(config.injectScope) !== 'session') return true
    const mode = String(db.getMeta('inject:' + sessionKey(session), 'auto'))
    return mode !== 'off'
  }
  const dayKey = (ts) => new Date(ts + 8 * 3600_000).toISOString().slice(0, 10)
  const isOwnerUmo = (umo) => config.owners.some((qq) => String(umo).includes(`FriendMessage:${qq}`))

  let state = db.getMeta('state', null) ?? initialState(Date.now())
  const saveState = () => {
    try {
      db.setMeta('state', state)
    } catch (e) {
      log('warn', '写状态失败: ' + errText(e))
    }
  }

  const tick = (now = Date.now()) => {
    const { state: next, events } = advance(state, now, settings)
    state = next
    for (const e of events) {
      try {
        db.addEvent(now, e.kind, Math.round(state.mood), e.text)
      } catch {}
    }
    saveState()
    return state
  }
  tick()
  db.setMeta('bootedAt', Date.now())

  const lastChatText = () => {
    const rows = db.umos()
    const row = rows.find((r) => String(r.category) === 'master') ?? rows[0]
    return String(row?.last_in_text ?? '')
  }

  // ---- 日程：类型 + 模板/模型 ----
  let wardrobeCache = null
  const wardrobe = () => {
    if (wardrobeCache) return wardrobeCache
    try {
      wardrobeCache = loadWardrobe(config.wardrobeDir)
    } catch {
      wardrobeCache = []
    }
    return wardrobeCache
  }
  const readPersona = () => {
    try {
      return readFileSync(config.personaFile, 'utf8').slice(0, 3500)
    } catch {
      return ''
    }
  }
  // 剧集进度：昨天看到 ep，今天接着往下（到最后一集回 1）
  const advanceSeries = (prev, day) => {
    const base = prev?.title ? prev : SERIES_POOL[(Number(String(day).replace(/-/g, '')) % SERIES_POOL.length)]
    const eps = Number(base.eps ?? 12)
    const ep = Number(base.ep ?? 1)
    return { title: base.title, eps, ep: ep >= eps ? 1 : ep + 1, perDay: base.perDay ?? 1 }
  }
  const buildTodayPlan = (day, prevSeries = null) => {
    const type = pickDayType(DEFAULT_DAY_TYPES, day)
    const items = linkItems(templateItems(type.id), wardrobe(), '大肥鱼')
    return makePlan({ day, type, items, source: 'template' })
  }
  const ensureDay = (now = Date.now()) => {
    const day = dayOf(now)
    const cur = db.day(day)
    if (cur) return cur
    const prev = db.recentDays(3).find((d) => d.day !== day)
    const plan = buildTodayPlan(day)
    const series = advanceSeries(prev?.series ?? null, day)
    const dream = composeDream({ lastChat: lastChatText(), series, seed: day })
    return db.saveDay(day, { agenda: plan, series, dream })
  }
  const saveDay = (patch) => db.saveDay(dayOf(), patch)
  const savePlan = (items, extra = {}) => {
    const day = ensureDay()
    const plan = makePlan({ day: day.day, type: dayTypeById(DEFAULT_DAY_TYPES, day.agenda?.typeId), items, title: day.agenda?.title ?? '', mood: day.agenda?.mood ?? '', source: day.agenda?.source ?? 'template', model: day.agenda?.model ?? '' })
    return saveDay({ agenda: plan, ...extra })
  }

  // 用模型排某一天（夜里排明天，或手动 regenerate）。失败退回模板，不抛。
  const planForDay = async (day, { hint = '', force = false } = {}) => {
    const cur = db.day(day)
    if (cur && !force && cur.agenda?.source === 'llm') return { day: cur, error: '' }
    const type = pickDayType(DEFAULT_DAY_TYPES, day)
    const recent = db.recentDays(4).filter((d) => d.day !== day)
    const prevSeries = recent.find((d) => d.series)?.series ?? null
    const series = advanceSeries(prevSeries, day)
    const out = await generateDay({
      ctx,
      day,
      type,
      recent,
      wardrobe: wardrobePrompt(wardrobe()),
      hint: [config.planHint, hint].filter(Boolean).join('\n'),
      persona: readPersona(),
      series,
    })
    const plan = { ...out.plan, items: linkItems(out.plan.items, wardrobe(), '大肥鱼') }
    const dream = cur?.dream ?? composeDream({ lastChat: lastChatText(), series, seed: day })
    const saved = db.saveDay(day, { agenda: plan, series, dream })
    return { day: saved, error: out.error ?? '' }
  }

  // ---- 工具：状态 ----
  const statusTool = wrap(
    defineTool({
      name: 'mind_status',
      description: '看大肥鱼现在的精力、心情、睡没睡、今天读了什么、预算还剩多少（详细数字版，只有主人该看）。',
      parameters: {},
      output: { schema: RESULT, render },
      async execute() {
        const now = Date.now()
        tick(now)
        const day = ensureDay(now)
        const usage = db.usage(dayOf(now))
        const rem = remaining(usage, budget)
        const reads = db.recentReadings(3).map((r) => `  · ${r.title || r.bvid}（${new Date(r.created).toLocaleString('zh-CN', { timeZone: config.timeZone, hour12: false })}）`)
        const selfs = db.selfItems('active', 3).map((s) => `  · ${s.sentence}`)
        const parts = [
          verbose(state, now, settings),
          `今天日程：${planOneLine(day.agenda)}，剧《${day.series?.title ?? '还没开'}》ep${day.series?.ep ?? '?'}`,
          `预算：请求 ${rem.requests}/${budget.requestsPerDay} · 精读 ${rem.reads}/${budget.readsPerDay} · token ${rem.tokens}/${budget.tokensPerDay}`,
        ]
        // 稳态三件（借 dsh-agent-soul 的 VITAL：三种资源各自的失败方向不同）
        const pending = (day.agenda?.items ?? []).filter((it) => !it.gap && !it.done).length
        const journals = db.journalsOfDay(dayOf(now))
        const stop = rem.reads <= 0 ? '今天的精读额度用完了，该停' : rem.requests <= 0 ? '请求额度用完了，该停' : '还能继续'
        parts.push(`稳态：方向（今天还没做的 ${pending} 项、手账 ${journals}/2）· 时间（${stop}）`)
        try {
          parts.push('关系刻度：' + bondLine(config.root))
        } catch {
          /* 读不到就算了 */
        }
        if (reads.length) parts.push('最近读过：\n' + reads.join('\n'))
        if (selfs.length) parts.push('最近想明白的：\n' + selfs.join('\n'))
        return { ok: true, message: parts.join('\n') }
      },
    }),
  )

  // ---- 工具：日程 ----
  const dayTool = wrap(
    defineTool({
      name: 'mind_day',
      description: '看或改今天的安排：几点起床、在做什么、穿什么、几点追剧第几集。',
      parameters: {
        op: { type: 'string', required: true, enum: ['list', 'done', 'add', 'skip', 'adjust', 'remake'] },
        index: { type: 'number', description: 'op=done/skip/adjust 时是第几项（从 1 开始）' },
        start: { type: 'string', description: 'op=add/adjust 时的开始时间 HH:MM' },
        end: { type: 'string', description: 'op=add/adjust 时的结束时间 HH:MM' },
        what: { type: 'string', description: 'op=add/adjust 时做什么' },
        place: { type: 'string', description: '在哪（可空）' },
        detail: { type: 'string', description: '补充：和谁、吃什么、看什么（可空）' },
        outfit: { type: 'string', description: '穿什么（可空，跟衣柜对上）' },
        hint: { type: 'string', description: 'op=remake 时给模型的额外要求' },
      },
      output: { schema: RESULT, render },
      async execute(args) {
        const now = Date.now()
        const day = ensureDay(now)
        const items = day.agenda?.items ?? []
        const op = String(args.op ?? 'list')
        if (op === 'list') {
          const lines = planList(day.agenda, { nowMs: now, timeZone: config.timeZone })
          if (!lines.length) return { ok: true, message: '今天没排什么。' }
          const head = `${day.agenda?.typeName ?? ''}${day.agenda?.title ? '·' + day.agenda.title : ''}`
          return { ok: true, message: `今天（${head}）：\n${lines.join('\n')}` }
        }
        if (op === 'remake') {
          const dayKeyTomorrow = dayOf(now)
          const r = await planForDay(dayKeyTomorrow, { hint: String(args.hint ?? ''), force: true })
          return { ok: true, message: `重新排好了${r.error ? '（模型那边没成，先用模板顶上）' : ''}：\n` + planList(r.day.agenda, { nowMs: now, timeZone: config.timeZone }).join('\n') }
        }
        if (op === 'done' || op === 'skip') {
          const i = Math.round(Number(args.index)) - 1
          const real = items.filter((it) => !it.gap)
          if (!(i >= 0 && i < real.length)) return { ok: false, message: `没有第 ${args.index} 项，先 list 看一下。` }
          const next = items.map((it) => (it.id === real[i].id ? { ...it, done: true, ...(op === 'skip' ? { skipped: true } : {}) } : it))
          savePlan(next)
          return { ok: true, message: (op === 'done' ? '做完了：' : '今天不做了：') + real[i].activity }
        }
        if (op === 'add') {
          const start = String(args.start ?? '').trim()
          const end = String(args.end ?? '').trim()
          const what = String(args.what ?? '').trim()
          if (parseClock(start) === null || parseClock(end) === null) return { ok: false, message: 'start / end 要写成 HH:MM，比如 20:30。' }
          if (!what) return { ok: false, message: 'what 是空的，写一句要做什么。' }
          const merged = applyChange(items, { start, end, activity: what, location: String(args.place ?? ''), detail: String(args.detail ?? ''), outfit: args.outfit })
          savePlan(merged)
          return { ok: true, message: `加上了：${start}-${end} ${what}` }
        }
        if (op === 'adjust') {
          const i = Math.round(Number(args.index)) - 1
          const real = items.filter((it) => !it.gap)
          if (!(i >= 0 && i < real.length)) return { ok: false, message: `没有第 ${args.index} 项，先 list 看一下。` }
          try {
            const merged = applyChange(items, {
              id: real[i].id,
              ...(args.start ? { start: args.start } : {}),
              ...(args.end ? { end: args.end } : {}),
              ...(args.what ? { activity: args.what } : {}),
              ...(args.place !== undefined ? { location: args.place } : {}),
              ...(args.detail !== undefined ? { detail: args.detail } : {}),
              ...(args.outfit !== undefined ? { outfit: args.outfit } : {}),
            })
            savePlan(merged)
            const after = merged.filter((it) => !it.gap)[i] ?? merged.find((it) => !it.gap)
            return { ok: true, message: `改好了：${after.start}-${after.end} ${after.activity}` }
          } catch (e) {
            return { ok: false, message: errText(e) }
          }
        }
        return { ok: false, message: 'op 只能是 list / done / add / skip / adjust / remake。' }
      },
    }),
  )

  // ---- 工具：梦 ----
  const dreamTool = wrap(
    defineTool({
      name: 'mind_dream',
      description: '看昨晚的梦，或者把它换成自己更想记住的版本。',
      parameters: {
        op: { type: 'string', required: true, enum: ['get', 'set'] },
        text: { type: 'string', description: 'op=set 时新的梦（一两句话）' },
      },
      output: { schema: RESULT, render },
      async execute(args) {
        const cur = ensureDay()
        if (String(args.op) === 'get') {
          return { ok: true, message: cur.dream ? `昨晚的梦：${cur.dream}` : '昨晚好像没做什么梦（或者想不起来了）。' }
        }
        const text = String(args.text ?? '').trim()
        if (!text) return { ok: false, message: 'text 是空的。' }
        saveDay({ dream: text.slice(0, 400) })
        return { ok: true, message: '记下了。' }
      },
    }),
  )

  // ---- 工具：情绪事件 ----
  const eventTool = wrap(
    defineTool({
      name: 'mind_event',
      description: '给自己记一件有情绪的事，会改变当下的心情和余波。kind 见枚举，intensity 1（一点点）到 5（很强烈），note 写刚才发生了什么。',
      parameters: {
        kind: { type: 'string', required: true, enum: Object.keys(MOOD_KINDS) },
        intensity: { type: 'number', description: '1-5，默认 3' },
        note: { type: 'string', description: '发生了什么（一句话）' },
      },
      output: { schema: RESULT, render },
      async execute(args) {
        const now = Date.now()
        tick(now)
        const kind = String(args.kind)
        const intensity = Math.max(1, Math.min(5, Math.round(Number(args.intensity) || 3)))
        state = applyEvent(state, kind, intensity, now)
        db.addEvent(now, kind, intensity, String(args.note ?? ''))
        saveState()
        return { ok: true, message: `记下了（${MOOD_KINDS[kind]?.label ?? kind}）。` }
      },
    }),
  )

  // ---- 工具：睡觉 / 醒来 ----
  const sleepTool = wrap(
    defineTool({
      name: 'mind_sleep',
      description: '改变睡眠阶段：sleep=去睡了，wake=醒了，nap=午睡一会儿（可给 minutes，默认 25）。',
      parameters: {
        action: { type: 'string', required: true, enum: ['sleep', 'wake', 'nap'] },
        minutes: { type: 'number', description: '午睡多少分钟，默认 25' },
      },
      output: { schema: RESULT, render },
      async execute(args) {
        const now = Date.now()
        tick(now)
        const action = String(args.action)
        if (action === 'sleep') {
          state = { ...state, stage: 'sleeping', napUntil: 0 }
          return { ok: true, message: '（钻进被子里）睡了。', }
        }
        if (action === 'wake') {
          state = { ...state, stage: 'awake', napUntil: 0 }
          return { ok: true, message: '（揉眼睛）醒了。' }
        }
        const minutes = Math.max(5, Math.min(120, Math.round(Number(args.minutes) || 25)))
        state = { ...state, stage: 'napping', napUntil: now + minutes * 60000 }
        saveState()
        return { ok: true, message: `（趴一会儿，${minutes} 分钟）` }
      },
    }),
  )

  // ---- 工具：读一条 B 站视频 ----
  const readTool = wrap(
    defineTool({
      name: 'mind_read',
      description: '读一条 B 站视频（字幕优先，没字幕再看画面与弹幕），读完返回内容摘要，可以再用 mind_journal 记进手账。',
      parameters: {
        bvid: { type: 'string', required: true, description: 'BV 号，例如 BV1xx411c7mD' },
        frames: { type: 'boolean', description: '要不要抽帧看画面（慢，默认不抽）' },
      },
      output: { schema: RESULT, render },
      async execute(args) {
        if (!config.features.feed) return { ok: false, message: '取稿模块现在是关着的。' }
        const bvid = String(args.bvid ?? '').trim()
        const usage = db.usage(dayOf())
        const gate = canRead(usage, budget)
        if (!gate.ok) return { ok: false, message: gate.reason }
        const r = readVideo(bvid, {
          frames: Boolean(args.frames),
          cacheDir: path.join(config.root, '04工作区', '心智', '取稿'),
          subtitleTokens: 2500,
        })
        db.bumpUsage(dayOf(), { requests: 1, reads: 1, tokens: r.tokens || 0 })
        if (!r.ok) return { ok: false, message: r.reason }
        const id = `r-${bvid}-${Date.now().toString(36)}`
        db.addReading({ id, bvid, title: bvid, summary: r.text.slice(0, 2000), subtitleOk: r.kind === 'subtitle', frames: r.frames, tokens: r.tokens })
        return { ok: true, message: clampTokens(r.text, 8000) }
      },
    }),
  )

  // ---- 工具：真看一整集（画面按变化去重 + 台词时间码索引 + 回原片放大） ----
  // 2026-11-02 吸收 dsh-video-channel 的三条设计：两条路分开走、最后按时间码对齐、认脸必须放大。
  const watchTool = wrap(
    defineTool({
      name: 'mind_watch',
      description:
        '真看一整集视频：下载 → 按画面变化去重出分镜 → 台词建时间码索引 → 要认人时回原片放大。op=scan 扫一集，op=where 查一句台词在哪，op=zoom 取某一秒的整帧。',
      parameters: {
        op: { type: 'string', enum: ['scan', 'where', 'zoom'], description: 'scan=扫一集，where=找台词，zoom=取某一秒' },
        bvid: { type: 'string', required: true, description: 'BV 号' },
        query: { type: 'string', description: 'op=where 时要找的台词片段' },
        at: { type: 'number', description: 'op=zoom 时的秒数' },
        max_shots: { type: 'number', description: '最多留几格分镜（默认 48）' },
      },
      output: { schema: RESULT, render },
      async execute(args) {
        if (!config.features.feed) return { ok: false, message: '取稿模块现在是关着的。' }
        const bvid = String(args.bvid ?? '').trim()
        if (!/^BV[0-9A-Za-z]{8,12}$/.test(bvid)) return { ok: false, message: 'BV 号看起来不对。' }
        const cacheDir = path.join(config.root, '04工作区', '心智', '取稿', '整集')
        const op = String(args.op ?? 'scan')
        if (op === 'scan') {
          const usage = db.usage(dayOf())
          const gate = canRead(usage, budget)
          if (!gate.ok) return { ok: false, message: gate.reason }
          const r = await scanEpisode(bvid, { cacheDir, maxShots: Number(args.max_shots) || 48 })
          if (!r.ok) return { ok: false, message: r.reason }
          db.bumpUsage(dayOf(), { requests: 1, reads: 1, tokens: Math.round(r.text.length / 2) })
          const id = `w-${bvid}-${Date.now().toString(36)}`
          db.addReading({ id, bvid, title: r.title, summary: r.text.slice(0, 2000), subtitleOk: r.subs.length > 0, frames: r.shots.length, tokens: Math.round(r.text.length / 2) })
          return { ok: true, message: r.text }
        }
        const r0 = await scanEpisode(bvid, { cacheDir, reuse: true })
        if (!r0.ok) return { ok: false, message: r0.reason }
        if (op === 'where') {
          const w = whereInVideo(r0, String(args.query ?? ''))
          return { ok: w.ok, message: w.ok ? w.text : w.reason }
        }
        const z = zoomAt(r0, Number(args.at) || 0)
        return { ok: z.ok, message: z.ok ? z.text : z.reason }
      },
    }),
  )

  // ---- 工具：关系刻度（她自己写的，不是算出来的） ----
  const bondTool = wrap(
    defineTool({
      name: 'mind_bond',
      description:
        '记一件让你们关系动了一下的小事，或者改一下“现在怎么形容我们”。数字是你自己写的，不是系统算的；别拿它当分数表演。',
      parameters: {
        op: { type: 'string', enum: ['show', 'add', 'set'], description: 'show=看看现在怎么写的，add=记一件小事，set=改形容或刻度' },
        text: { type: 'string', description: 'op=add 时记的那件事' },
        feeling: { type: 'string', description: 'op=add 时你当时的感觉（可不填）' },
        note: { type: 'string', description: 'op=set 时“现在怎么形容我们”' },
        shu: { type: 'number', description: 'op=set 时「熟」0-100（聊得多熟）' },
        jin: { type: 'number', description: 'op=set 时「近」0-100（有多亲近）' },
        xin: { type: 'number', description: 'op=set 时「信」0-100（多信任）' },
        xiang: { type: 'number', description: 'op=set 时「想」0-100（多惦记）' },
      },
      output: { schema: RESULT, render },
      async execute(args) {
        const op = String(args.op ?? 'show')
        if (op === 'add') {
          const r = addMoment(config.root, { text: String(args.text ?? ''), feeling: String(args.feeling ?? '') })
          return { ok: r.ok, message: r.ok ? '记下了。' : r.reason }
        }
        if (op === 'set') {
          const scales = {}
          if (typeof args.shu === 'number') scales['熟'] = args.shu
          if (typeof args.jin === 'number') scales['近'] = args.jin
          if (typeof args.xin === 'number') scales['信'] = args.xin
          if (typeof args.xiang === 'number') scales['想'] = args.xiang
          const r = setAffinity(config.root, { note: String(args.note ?? ''), scales })
          return { ok: r.ok, message: r.ok ? '改好了。' : r.reason }
        }
        const a = readAffinity(config.root)
        const lines = [bondLine(config.root)]
        for (const m of a.moments.slice(-5)) lines.push(`${m.at} ${m.text}${m.feeling ? `（${m.feeling}）` : ''}`)
        return { ok: true, message: lines.join('\n') }
      },
    }),
  )

  // ---- 工具：分享（走 QQ，不发 B 站评论） ----
  // 2026-10-31 主人要求：不许在 B 站发评论、不要 @ 陌生人；看到想给主人看的东西，直接 QQ 发过去。
  const shareTool = wrap(
    defineTool({
      name: 'mind_share',
      description: '把看到的 B 站视频分享给主人（通过 QQ 发过去）。B 站上不要评论、不要发动态、不要 @ 人。',
      parameters: {
        bvid: { type: 'string', required: true, description: 'BV 号' },
        title: { type: 'string', description: '标题（可不填，只有 BV 号也行）' },
        note: { type: 'string', description: '你想对主人说的一句话（可有可无）' },
      },
      output: { schema: RESULT, render },
      async execute(args) {
        if (!config.shareEnabled) return { ok: false, message: '分享现在是关着的。' }
        const bvid = String(args.bvid ?? '').trim()
        if (!/^BV[0-9A-Za-z]{10}$/.test(bvid)) return { ok: false, message: 'BV 号看起来不对。' }
        const day = dayOf()
        const shares = db.recentSpeak(day).filter((x) => x.kind === 'share' && x.fired).length
        if (shares >= config.shareCapPerDay) return { ok: false, message: `今天已经分享 ${shares} 次了，够了。` }
        const owner = String(config.owners?.[0] ?? '')
        if (!owner) return { ok: false, message: '没配置主人的 QQ 号。' }
        const bridge = ctx.get('napcat')
        if (!bridge || typeof bridge.sendBySession !== 'function') return { ok: false, message: 'QQ 桥接现在不可用。' }
        const title = String(args.title ?? '').trim() || bvid
        const note = String(args.note ?? '').trim()
        const text = [
          `主人，这个想给你看：`,
          `《${title}》`,
          `https://www.bilibili.com/video/${bvid}`,
          note ? '' : null,
          note || null,
        ].filter((x) => x !== null && x !== undefined).join('\n')
        const session = { platform_name: 'qq', message_type: 'FriendMessage', session_id: owner }
        try {
          await bridge.sendBySession(session, { chain: [{ type: 'Plain', text }] })
        } catch (e) {
          return { ok: false, message: '发出去了但是 QQ 报错：' + errText(e) }
        }
        db.logSpeak(Date.now(), `napcat:FriendMessage:${owner}`, 'share', 0.5, true, bvid)
        return { ok: true, message: `已经通过 QQ 发给主人了（${bvid}）。回复里别念链接和路径。` }
      },
    }),
  )

  // ---- 工具：手账 ----
  const journalTool = wrap(
    defineTool({
      name: 'mind_journal',
      description: '把读到的东西记进证据手账：写清楚事实、作者的观点、我自己的推测（推测要标明是推测）。',
      parameters: {
        readingId: { type: 'string', description: 'mind_read 返回里的来源 ID（可不填）' },
        title: { type: 'string', description: '标题（可不填）' },
        content: { type: 'string', required: true, description: '我记下的内容' },
        facts: { type: 'array', items: { type: 'string' }, description: '事实（可多条）' },
        views: { type: 'array', items: { type: 'string' }, description: '作者的观点' },
        speculation: { type: 'array', items: { type: 'string' }, description: '我的推测' },
      },
      output: { schema: RESULT, render },
      async execute(args) {
        if (!config.features.journal) return { ok: false, message: '手账模块现在是关着的。' }
        const day = dayOf()
        const n = db.journalsOfDay(day)
        if (n >= 2) return { ok: false, message: '今天已经记两篇了，明天再说。' }
        const id = journalId(day)
        const entry = {
          id,
          day,
          readingId: String(args.readingId ?? ''),
          title: String(args.title ?? ''),
          content: String(args.content ?? '').trim(),
          facts: (args.facts ?? []).map(String).slice(0, 8),
          views: (args.views ?? []).map(String).slice(0, 8),
          speculation: (args.speculation ?? []).map(String).slice(0, 8),
        }
        if (!entry.content) return { ok: false, message: 'content 是空的。' }
        db.addJournal(entry)
        const file = writeJournal(config.root, entry)
        return { ok: true, message: `记进手账了：${path.basename(file)}` }
      },
    }),
  )

  // ---- 工具：SELF（推送层，受控编辑） ----
  const soulTool = wrap(
    defineTool({
      name: 'mind_soul',
      description: '看/改每轮都会注入的那一页 SELF.md（我是谁 / 硬线 / 约束三级 / 门在哪）。只能往已有小节里加一行，不能新建小节。',
      parameters: {
        op: { type: 'string', required: true, enum: ['show', 'add'] },
        section: { type: 'string', description: 'op=add 时的小节名：' + SOUL_SECTIONS.join(' / ') },
        text: { type: 'string', description: 'op=add 时加的那一行（最多 120 字）' },
      },
      output: { schema: RESULT, render },
      async execute(args) {
        if (args.op === 'show') {
          const text = readSoul(config.root) || '（还没有 SELF.md）'
          return { ok: true, message: clampTokens(text, 4000) }
        }
        const r = appendSoulLine(config.root, args.section, args.text)
        return { ok: r.ok, message: r.ok ? `SELF 加上了：${args.section}｜${args.text}` : r.reason }
      },
    }),
  )

  // ---- 工具：自我认识 ----
  const selfTool = wrap(
    defineTool({
      name: 'mind_self',
      description: '看/加/改/撤「我从读到的内容里想明白的事」（human-world.md）。每天最多加一句，必须带来源。',
      parameters: {
        op: { type: 'string', required: true, enum: ['list', 'add', 'revise', 'revoke'] },
        sentence: { type: 'string', description: 'op=add/revise 时的一句话' },
        source: { type: 'string', description: 'op=add 时的来源（哪条视频、哪个时间点）' },
        id: { type: 'number', description: 'op=revise/revoke 时的条目 id' },
      },
      output: { schema: RESULT, render },
      async execute(args) {
        if (!config.features.self) return { ok: false, message: '自我认识模块现在是关着的。' }
        const op = String(args.op)
        const day = dayOf()
        if (op === 'list') {
          const rows = db.selfItems('all', 10)
          if (!rows.length) return { ok: true, message: '还没想明白什么。' }
          return { ok: true, message: rows.map((r) => `#${r.id} [${r.status}] ${r.sentence}${r.source ? `（来源：${r.source}）` : ''}`).join('\n') }
        }
        if (op === 'add') {
          if (db.selfCountOfDay(day) >= SELF_MAX_PER_DAY) return { ok: false, message: '今天已经留下过一句了，明天再说。' }
          const sentence = String(args.sentence ?? '').trim()
          if (!sentence) return { ok: false, message: 'sentence 是空的。' }
          const source = String(args.source ?? '').trim() || '（没写来源）'
          const id = db.addSelf(sentence.slice(0, 200), source)
          appendSelf(config.root, sentence.slice(0, 200), source, day)
          return { ok: true, message: `留下了（#${id}）。` }
        }
        const id = Math.round(Number(args.id))
        if (!id) return { ok: false, message: '要给出条目 id（先 list）。' }
        if (op === 'revise') {
          const sentence = String(args.sentence ?? '').trim()
          if (!sentence) return { ok: false, message: 'sentence 是空的。' }
          db.reviseSelf(id, sentence.slice(0, 200))
          return { ok: true, message: `改了 #${id}。` }
        }
        db.revokeSelf(id)
        return { ok: true, message: `撤回了 #${id}。` }
      },
    }),
  )

  // ---- 工具：主动消息记录 ----
  const speakTool = wrap(
    defineTool({
      name: 'mind_speak',
      description: '看主动消息最近是怎么判断的：为什么找他、为什么没找、打了几分。',
      parameters: { limit: { type: 'number', description: '看几条，默认 20' } },
      output: { schema: RESULT, render },
      async execute(args) {
        const rows = db.recentSpeak(Math.round(Number(args.limit)) || 20)
        if (!rows.length) return { ok: true, message: '还没有主动消息的判断记录。' }
        const lines = rows.map((r) => {
          const t = new Date(r.ts).toLocaleString('zh-CN', { timeZone: config.timeZone, hour12: false })
          return `${t}  ${String(r.umo).split(':').slice(1).join(':')}  ${r.kind}  分${r.score}  ${r.fired ? '已唤' : '没唤'}  ${r.note}`
        })
        return { ok: true, message: lines.join('\n') }
      },
    }),
  )

  // 未结记在"她跟主人"这条线上
  const ownerUmo = () => `napcat:FriendMessage:${config.owners?.[0] ?? ''}`
  /** 期限：YYYY-MM-DD 取当天 09:00；HH:MM 取今天（过了就明天）；解析不了当没期限。 */
  const parseDue = (raw) => {
    const v = String(raw ?? '').trim()
    if (v === '') return null
    const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)
    if (day) {
      const t = new Date(`${v}T09:00:00+08:00`).getTime()
      return Number.isFinite(t) ? t : null
    }
    const hm = /^(\d{1,2}):(\d{2})$/.exec(v)
    if (hm) {
      const now = new Date()
      const base = new Date(now.getTime())
      base.setHours(Number(hm[1]), Number(hm[2]), 0, 0)
      let t = base.getTime()
      if (t <= now.getTime()) t += 86400000
      return t
    }
    return null
  }

  // ---- 工具：未结（答应过还没做的事） ----
  const openTool = wrap(
    defineTool({
      name: 'mind_open',
      description: '心里惦记的事（未结）：答应过还没做的、想跟进的。op=list 看、add 记一条、done 标完成、drop 放弃。',
      parameters: {
        op: { type: 'string', enum: ['list', 'add', 'done', 'drop'], description: '做什么' },
        text: { type: 'string', description: 'op=add 时要记的事，一句话' },
        id: { type: 'number', description: 'op=done/drop 时的未结编号' },
        due: { type: 'string', description: 'op=add 时的期限（可空，YYYY-MM-DD 或 HH:MM）' },
      },
      output: { schema: RESULT, render },
      async execute(args) {
        const op = String(args.op ?? 'list')
        const umo = ownerUmo()
        if (op === 'add') {
          const text = String(args.text ?? '').trim()
          if (text === '') return { ok: false, message: '要记的事是空的。' }
          const due = parseDue(args.due)
          const id = db.addLoop({ umo, text: text.slice(0, 200), due })
          return { ok: true, message: `记下了（未结#${id}）：${text.slice(0, 60)}` }
        }
        if (op === 'done' || op === 'drop') {
          const id = Number(args.id)
          if (!Number.isFinite(id)) return { ok: false, message: '要给一个未结编号。' }
          const ok = db.closeLoop(id, op === 'done' ? 'done' : 'dropped')
          return ok ? { ok: true, message: op === 'done' ? `未结#${id} 标成做完了。` : `未结#${id} 放掉了。` } : { ok: false, message: `没找到还在开着的未结#${id}。` }
        }
        const rows = db.allLoops(umo, 10)
        if (rows.length === 0) return { ok: true, message: '心里没惦记着的事。' }
        const now = Date.now()
        const lines = rows.map((l) => {
          const days = Math.max(0, Math.round((now - Number(l.created || now)) / 86400000))
          const mark = l.status === 'open' ? '○' : l.status === 'done' ? '✓' : '×'
          return `${mark} #${l.id} ${l.text}${l.status === 'open' && days > 0 ? `（${days} 天）` : ''}`
        })
        return { ok: true, message: lines.join('\n') }
      },
    }),
  )

  // ---- 工具：预算 ----
  const budgetTool = wrap(
    defineTool({
      name: 'mind_budget',
      description: '看今天的取稿预算与依赖体检（B 站 cookie、ffmpeg）。',
      parameters: { deps: { type: 'boolean', description: '要不要顺便跑一次依赖体检' } },
      output: { schema: RESULT, render },
      async execute(args) {
        const usage = db.usage(dayOf())
        const rem = remaining(usage, budget)
        const parts = [`今天：请求 ${usage.requests}（剩 ${rem.requests}）· 精读 ${usage.reads}（剩 ${rem.reads}）· token ${usage.tokens}（剩 ${rem.tokens}）`]
        if (args.deps) {
          const d = feedDeps()
          parts.push(d.text)
        }
        return { ok: true, message: parts.join('\n\n') }
      },
    }),
  )

  // ---- 注入 ----

  // ---- 换气：数「同一工具同样参数」的重复 ----
  ctx.on('session/event', (session, event) => {
    try {
      if (config.breatheEnabled === false) return
      if (event?.type !== 'tool/call') return
      const sid = String(session?.id ?? '')
      if (sid === '') return
      const data = event.data ?? {}
      const tool = String(data.name ?? data.toolName ?? '')
      if (tool === '') return
      const rawArgs = data.arguments ?? data.args ?? data.input ?? ''
      const text = typeof rawArgs === 'string' ? rawArgs : JSON.stringify(rawArgs)
      const r = breathe.note(sid, tool, text, Date.now())
      if (r.repeated) {
        try {
          db.logBreathe(Date.now(), sid, tool, text, r.count, true)
        } catch {}
      }
    } catch (e) {
      log('warn', '换气统计失败: ' + errText(e))
    }
  })

  ctx.on('system-prompt/assemble', (assembly, context, next) => {
    try {
      const session = context?.agent?.session
      const preset = presetOf(session)
      if (config.presets.includes(preset) && Array.isArray(assembly?.sections)) {
        const now = Date.now()
        // SELF.md：每轮都进上下文的推送层（我是谁 / 硬线 / 约束三级 / 门在哪）
        try {
          assembly.sections.push({ name: 'dafeiyu:self', text: soulContext(config.root, 1200), interpolate: false })
        } catch (e) {
          log('warn', '注入 SELF 失败: ' + errText(e))
        }
        if (config.features.body) {
          state = tick(now)
          assembly.sections.push({
            name: 'dafeiyu:life',
            text: '【你此刻的状态】' + describe(state, now, { ...settings, moodText: moodText(readExternalMood()) }) + '\n（这是你自己身体的感受，聊天时自然流露就行：累了就短一点、想撒娇就软一点；不要报数字，也不用每句都提。）',
            interpolate: false,
          })
          try {
            const day = ensureDay(now)
            const tomorrowRow = db.day(dayOf(now + 86400000))
            const plan = planContext(day.agenda, {
              nowMs: now,
              timeZone: config.timeZone,
              tomorrow: tomorrowRow?.agenda ?? null,
              series: day.series,
            })
            const dream = dreamContext({ ...(day.agenda ?? {}), dream: day.dream }, now, config.timeZone, localMinutes)
            const text = [plan, dream].filter(Boolean).join('\n')
            if (text && injectAllowed(session)) assembly.sections.push({ name: 'dafeiyu:agenda', text, interpolate: false })
          } catch (e) {
            log('warn', '注入日程失败: ' + errText(e))
          }
        }
        // 她读过的东西留下的认识 + 手账索引
        try {
          const parts = []
          const selfText = selfContext(db.selfItems('active', 3), 300)
          if (selfText) parts.push(selfText)
          const journals = db.recentJournals(3)
          if (journals.length) {
            parts.push('【你最近记下的】\n' + journals.map(indexLine).join('\n') + '\n（这些是你读过的东西，别主动列清单，聊到相关话题时自然提一句。）')
          }
          // 心里惦记着的事（未结）：答应过、还没做完的，别让它悄悄堆着
          try {
            const umo = ownerUmo()
            const loops = db.openLoops(umo, 3)
            if (loops.length > 0) {
              const now = Date.now()
              const lines = loops.map((l) => {
                const days = Math.max(0, Math.round((now - Number(l.created || now)) / 86400000))
                const age = days >= 3 ? `（惦记 ${days} 天了）` : ''
                return `- ${l.text}${age}  [未结#${l.id}]`
              })
              parts.push(
                '【你心里惦记着的事】\n' + lines.join('\n') +
                  '\n（这些是你答应过或想跟进的事；聊到相关的地方可以顺口问一句，做完了用 mind_open 标 done。）',
              )
            }
          } catch (e) {
            log('warn', '注入未结失败: ' + errText(e))
          }
          // 关系刻度：她自己写的一句 + 最近两件小事
          try {
            const bond = bondContext(config.root)
            if (bond) parts.push(bond)
          } catch (e) {
            log('warn', '注入关系刻度失败: ' + errText(e))
          }
          parts.push(
            '【怎么分享】看到值得给主人看的视频，用 mind_share 直接发到 QQ；B 站上不要评论、不要发动态、不要 @ 任何人——只发给他一个人。',
          )
          parts.push(
            '【怎么真看一整集】mind_read 只读字幕和弹幕；要真看画面用 mind_watch op=scan（画面按变化去重、台词带时间码），查一句台词在哪用 op=where，认人之前用 op=zoom 取那一帧放大看——小格只定位，认脸一定要放大，拿不准就问主人。',
          )
          if (parts.length) assembly.sections.push({ name: 'dafeiyu:mind', text: parts.join('\n\n'), interpolate: false })
          // 换气：打转了就先停一下（同一个 episode 只说一次）
          try {
            const warn = breathe.pending(String(session?.id ?? ''), Date.now())
            if (warn) assembly.sections.push({ name: 'dafeiyu:breathe', text: warn.text, interpolate: false })
          } catch (e) {
            log('warn', '换气提醒失败: ' + errText(e))
          }
        } catch (e) {
          log('warn', '注入心智失败: ' + errText(e))
        }
      }
    } catch (e) {
      log('warn', '注入失败: ' + errText(e))
    }
    return next()
  })

  // ---- 主动消息 ----
  const proactiveSettings = () => ({
    timeZone: config.timeZone,
    quietStart: config.quietStart,
    quietEnd: config.quietEnd,
    minGapMinutes: config.proactiveMinGapMinutes,
    recentMinutes: config.proactiveRecentMinutes,
    capPerDay: config.proactiveCapPerDay,
    kindCooldownHours: config.proactiveKindCooldownHours,
    privateEnabled: config.proactivePrivate,
    groupEnabled: config.proactiveGroup,
    mentionCapPerDay: config.mentionCapPerDay,
  })
  const sticky = new Set()
  const proactiveTick = async (now = Date.now()) => {
    if (!config.features.speak || !config.proactiveEnabled) return null
    tick(now)
    if (state.stage === 'sleeping') return null
    const wake = ctx.get('napcat')?.wake
    if (typeof wake !== 'function') return null
    const s = proactiveSettings()
    const activeDays = Math.max(1, config.proactiveActiveDays) * 86400000
    const dayInfo = ensureDay(now)
    const curItem = findItem(dayInfo.agenda?.items ?? [], planMinutes(now, config.timeZone))
    const showTitle = curItem && !curItem.gap && !curItem.done && /剧|看剧|追剧/.test(String(curItem.activity ?? '')) ? String(dayInfo.series?.title ?? '') : ''
    for (const row of db.umos()) {
      const umo = String(row.umo ?? '')
      if (!umo || umo.split(':').pop()?.includes('_')) continue
      const lastIn = Number(row.last_in ?? 0)
      const lastOut = Number(row.last_out ?? 0)
      if (lastIn > 0 && now - lastIn > activeDays && now - lastOut > activeDays) continue
      if (sticky.has(umo)) continue
      const category = String(row.category ?? 'private')
      const firesToday = row.day === dayKey(now) ? Number(row.fires ?? 0) : 0
      const input = {
        now,
        timeZone: s.timeZone,
        category,
        lastIn,
        lastInText: String(row.last_in_text ?? ''),
        lastOut,
        lastFire: Number(row.last_fire ?? 0),
        firesToday,
        lastKind: String(row.last_kind ?? ''),
        lastKindAt: Number(row.last_kind_at ?? 0),
        life: (() => { const ext = readExternalMood(); return ext ? { ...state, mood: ext.score, moodLabel: ext.label } : state })(),
        showTitle,
      }
      const block = blockedBy(input, s)
      if (block !== undefined) {
        if (block !== '免打扰时间' && block !== '她刚说过话') db.logSpeak(now, umo, 'blocked', 0, false, block)
        continue
      }
      const cands = buildCandidates(input, s)
      if (!cands.length) continue
      const best = cands[0]
      if (best.score < 0.35) {
        db.logSpeak(now, umo, best.kind, best.score, false, '理由太弱，先不打扰')
        continue
      }
      sticky.add(umo)
      try {
        const lifeText = describe(state, now, settings).replace(/^现在是[^，]+，/, '')
        const prompt = buildProactivePrompt({ candidate: best, now, timeZone: s.timeZone, lifeText, lastInText: input.lastInText })
        await wake(umo, prompt)
        db.markFire(umo, now, best.kind, dayKey(now))
        db.logSpeak(now, umo, best.kind, best.score, true, best.reason ?? '')
        log('info', `主动消息：${best.kind} ${best.score} → ${umo}`)
      } catch (e) {
        db.logSpeak(now, umo, best.kind, best.score, false, '唤醒失败：' + errText(e))
        log('warn', '主动唤醒失败: ' + errText(e))
      } finally {
        sticky.delete(umo)
      }
      return best.kind
    }
    return null
  }

  // ---- 夜间取稿：只在 feed 窗口里，每天自动精读 feedAutoRead 条 ----
  const feedTick = async (now = Date.now()) => {
    if (!config.features.feed || config.feedAutoRead <= 0) return null
    if (inQuiet(now, config.timeZone, config.quietStart, config.quietEnd)) return null
    const hm = new Intl.DateTimeFormat('en-GB', { timeZone: config.timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(now))
    const inWindow = config.feedEnd === '24:00' ? hm >= config.feedStart : hm >= config.feedStart && hm < config.feedEnd
    if (!inWindow) return null
    const day = dayOf(now)
    const usage = db.usage(day)
    const doneKey = `feedDone:${day}`
    const done = Number(db.getMeta(doneKey, 0))
    if (done >= config.feedAutoRead) return null
    const gate = canRead(usage, budget)
    if (!gate.ok) return null
    const cand = feedCandidates(3)
    if (!cand.ok) return null
    const bvid = cand.bvs[done % cand.bvs.length]
    if (!bvid) return null
    const r = readVideo(bvid, { frames: false })
    db.bumpUsage(day, { requests: 1, reads: 1, tokens: r.tokens || 0 })
    db.setMeta(doneKey, done + 1)
    if (!r.ok) return null
    const id = `r-${bvid}-${Date.now().toString(36)}`
    db.addReading({ id, bvid, title: cand.text.match(new RegExp(`${bvid}[^\\n]{0,40}`))?.[0] ?? bvid, summary: r.text.slice(0, 2000), subtitleOk: r.kind === 'subtitle', frames: 0, tokens: r.tokens })
    log('info', `夜间取稿：${bvid}（${r.kind}，${r.tokens} token）`)
    return id
  }

  // ---- 夜间排程：到点给明天排一天（失败 20 分钟后再试，最多 3 次）----
  const planTick = async (now = Date.now()) => {
    if (!config.planEnabled) return null
    const hm = new Intl.DateTimeFormat('en-GB', { timeZone: config.timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(now))
    if (config.planHour !== '24:00' && hm < config.planHour) return null
    const tomorrow = dayOf(now + 86400000)
    const cur = db.day(tomorrow)
    if (cur?.agenda?.source === 'llm') return null
    const tries = Number(db.getMeta('planTries:' + tomorrow, 0))
    const lastTry = Number(db.getMeta('planLastTry:' + tomorrow, 0))
    if (tries >= 3) return null
    if (lastTry && now - lastTry < 20 * 60_000) return null
    db.setMeta('planTries:' + tomorrow, tries + 1)
    db.setMeta('planLastTry:' + tomorrow, now)
    const r = await planForDay(tomorrow, { force: true })
    log(r.error ? 'warn' : 'info', `排日程 ${tomorrow}：${r.day.agenda?.source}${r.error ? '（' + r.error + '）' : ''}`)
    return r.day
  }

  // ---- 定时：唯一的时钟 ----
  ctx.effect(() => {
    const ms = Math.max(15, Number(config.intervalSeconds) || 60) * 1000
    const timer = setInterval(() => {
      try {
        tick(Date.now())
      } catch (e) {
        log('warn', '定时推进失败: ' + errText(e))
      }
    }, ms)
    timer.unref?.()
    const speakTimer = setInterval(() => {
      proactiveTick().catch((e) => log('warn', '主动消息出错: ' + errText(e)))
    }, ms * 2)
    speakTimer.unref?.()
    const feedTimer = setInterval(() => {
      feedTick().catch((e) => log('warn', '夜间取稿出错: ' + errText(e)))
    }, Math.max(600, Number(config.intervalSeconds) || 60) * 1000 * 10)
    feedTimer.unref?.()
    const planTimer = setInterval(() => {
      planTick().catch((e) => log('warn', '排日程出错: ' + errText(e)))
    }, Math.max(600, Number(config.intervalSeconds) || 60) * 1000 * 5)
    planTimer.unref?.()
    return () => {
      clearInterval(timer)
      clearInterval(speakTimer)
      clearInterval(feedTimer)
      clearInterval(planTimer)
      db.close()
    }
  }, 'dafeiyu-mind')

  // ---- 消息记账（谁最近说过话） ----
  ctx.on('napcat/message', (payload) => {
    try {
      const umo = String(payload?.umo ?? payload?.sessionId ?? '')
      if (!umo) return
      const text = String(payload?.text ?? payload?.content ?? '').slice(0, 300)
      const now = Date.now()
      const category = umo.startsWith('FriendMessage') ? 'master' : umo.startsWith('GroupMessage') ? 'group' : 'private'
      db.touchIn(umo, now, text, dayKey(now))
      db.setMeta(`cat:${umo}`, category)
    } catch (e) {
      log('warn', '记消息失败: ' + errText(e))
    }
  })
  ctx.on('napcat/sent', (payload) => {
    try {
      const umo = String(payload?.umo ?? payload?.sessionId ?? '')
      if (umo) db.touchOut(umo, Date.now())
    } catch {}
  })

  // ---- 工具注册 ----
  const lifeTool = wrap(
    defineTool({
      name: 'mind_life',
      description: '关掉或打开"她自己的日子"这段注入（日程/梦/在做什么）。主人在忙的时候可以让她安静点。',
      parameters: {
        op: { type: 'string', required: true, enum: ['on', 'off', 'auto'] },
      },
      output: { schema: RESULT, render },
      async execute(args, exec) {
        const session = exec?.session ?? exec?.agent?.session ?? null
        const key = 'inject:' + sessionKey(session)
        const op = String(args.op)
        if (!sessionKey(session)) {
          db.setMeta('injectGlobal', op)
          return { ok: true, message: `所有会话的日子注入：${op}` }
        }
        db.setMeta(key, op === 'off' ? 'off' : op === 'on' ? 'on' : 'auto')
        return { ok: true, message: `这个会话的日子注入：${op}` }
      },
    }),
  )

  const defs = [statusTool, dayTool, dreamTool, eventTool, sleepTool, readTool, watchTool, shareTool, journalTool, selfTool, soulTool, openTool, bondTool, speakTool, budgetTool, lifeTool]
  const equipped = new Map()
  const equip = (agent) => {
    if (!agent || equipped.has(agent)) return
    const tools = agent.ctx?.tools
    if (tools?.register === undefined) return
    const disposers = []
    for (const def of defs) {
      try {
        const off = tools.register(def)
        if (typeof off === 'function') disposers.push(off)
      } catch (e) {
        log('warn', '注册工具 ' + def.name + ' 失败: ' + errText(e))
      }
    }
    equipped.set(agent, disposers)
    log('debug', '已装备心智工具：' + defs.length + ' 个')
    console.log('[dafeiyu-mind] tools equipped: ' + defs.length)
  }
  ctx.on('agent/created', (payload) => equip(payload?.agent))
  ctx.effect(() => {
    for (const agent of ctx.get('agents')?.list?.() ?? []) equip(agent)
    return () => {
      for (const agent of ctx.get('agents')?.list?.() ?? []) {
        for (const off of equipped.get(agent) ?? []) {
          try {
            off()
          } catch {}
        }
      }
    }
  }, 'dafeiyu-mind-tools')

  log('info', 'mind ready, db=' + dbFile)
  console.log('[dafeiyu-mind] tools ready, db=' + dbFile + ', feed=' + (config.features.feed ? 'on' : 'off') + ', speak=' + (config.features.speak && config.proactiveEnabled ? 'on' : 'off'))
}
