// 大肥鱼的插件管理工具：列插件、按需开关。
// 为什么单独做：聊天里用不上的插件（游戏启动器、日程、taste、news…）每个都往提示词里塞 schema，
// 109 个工具合计 16k tokens，而且它们在 system/tools 之后，只要一变，后面的消息缓存全失效。
// 所以做法不是「每轮动态换工具」，而是：**平时关着，需要时用这个工具打开，用完再关**。
import { defineTool } from '@deepseek-ai/dsh-tools'
import z from '@deepseek-ai/schemastery'

export const name = 'dafeiyu-plugins'
export const inject = ['tools']

export const Config = z.object({
  owners: z.array(z.string()).default([]).description('主人 QQ 号（只有他能在私聊里开关插件）'),
  allow: z
    .array(z.string())
    .default([
      'launcher',
      'dsh-launcher',
      'bili-whale',
      'image-studio',
      'memewiki',
      'news',
      'taste',
      'modlens',
      'billion-context',
      'video-skin',
      'boot-animation',
      'mood',
      'remember-you',
      'at-file',
      'genui',
      'token-diet',
      'better-sidebar',
      'whale-widget',
      'dshmarket',
      'pet',
      'context',
      'skill-office',
    ])
    .description('允许她开关的插件（按 entryId / moduleName 子串匹配）'),
  deny: z
    .array(z.string())
    .default([
      'companion-core',
      'dafeiyu-vault',
      'dafeiyu-mind',
      'dafeiyu-qq-tools',
      'dafeiyu-runtime',
      'dafeiyu-plugins',
      'napcat-bridge',
      'plugin-manager',
      'agent-preset',
      'session',
      'client-ui',
    ])
    .description('绝对不能碰的（关了会把她自己弄坏）'),
})

const RESULT = {
  type: 'object',
  additionalProperties: false,
  properties: { ok: { type: 'boolean', required: true }, message: { type: 'string', required: true } },
}
const render = (_a, v) => [{ type: 'text', text: String(v.message ?? '') }]
const errText = (e) => (e instanceof Error ? e.message : String(e))

export function apply(ctx, config) {
  const log = (level, text) => {
    try {
      ctx.logger(level)('[dafeiyu-plugins] ' + text)
    } catch {}
  }
  const manager = () => ctx.get('pluginManager')
  const isOwner = (exec) => {
    const umo = String(ctx.get('napcat')?.sessionInfo?.(String(exec?.agent?.session?.id ?? ''))?.umo ?? '')
    const parts = umo.split(':')
    return parts[1] === 'FriendMessage' && config.owners.includes(parts.slice(2).join(':'))
  }
  const hit = (row, list) => {
    const key = `${row.entryId ?? ''} ${row.moduleName ?? ''}`.toLowerCase()
    return list.some((k) => key.includes(String(k).toLowerCase()))
  }
  const rows = async () => {
    const m = manager()
    if (m?.listPlugins === undefined) throw new Error('插件管理器没接上（pluginManager 服务不可用）。')
    const list = await m.listPlugins({})
    return Array.isArray(list) ? list : (list?.rows ?? [])
  }

  // ---- 列插件 ----
  const listTool = defineTool({
    name: 'plugins_list',
    description: [
      '列出这台机器上的插件和它们开没开（entryId / 模块名 / 状态）。',
      '想省提示词、或者需要某个平时关着的功能时，先用它看看有哪些可以开关。',
      'filter 可以按名字筛（比如 "launcher"、"news"）。',
    ].join('\n'),
    parameters: {
      filter: { type: 'string', description: '按名字筛选（可选，子串匹配）' },
      only: { type: 'string', enum: ['all', 'on', 'off', 'toggleable'], description: '只看开着的 / 关着的 / 可以开关的（默认 toggleable）' },
    },
    output: { schema: RESULT, render },
    async execute(args) {
      try {
        const all = await rows()
        const f = String(args.filter ?? '').trim().toLowerCase()
        const only = String(args.only ?? 'toggleable')
        let list = all
        if (f !== '') list = list.filter((r) => `${r.entryId} ${r.moduleName}`.toLowerCase().includes(f))
        if (only === 'on') list = list.filter((r) => r.enabled === true)
        else if (only === 'off') list = list.filter((r) => r.enabled === false)
        else if (only === 'toggleable') list = list.filter((r) => hit(r, config.allow) && !hit(r, config.deny))
        if (list.length === 0) return { ok: true, message: '没有匹配的插件。' }
        const lines = list.slice(0, 60).map((r) => {
          const mark = r.enabled === true ? '✓' : '✗'
          const phase = r.fiberPhase && r.fiberPhase !== 'active' ? `（${r.fiberPhase}）` : ''
          const locked = hit(r, config.deny) ? ' 🔒' : ''
          return `${mark} ${r.entryId}${locked}${phase}`
        })
        const more = list.length > 60 ? `\n…还有 ${list.length - 60} 条` : ''
        return { ok: true, message: `共 ${list.length} 条（✓ 开 / ✗ 关 / 🔒 不能碰）：\n` + lines.join('\n') + more }
      } catch (e) {
        return { ok: false, message: '列不出来：' + errText(e) }
      }
    },
  })

  // ---- 开关插件 ----
  const switchTool = defineTool({
    name: 'plugins_switch',
    description: [
      '打开或关掉一个插件（立即生效，不用重启）。关掉之后它带来的工具会从下一轮的提示里消失，省 token。',
      '只允许主人在私聊里用；核心插件（人格/记忆/小窝/心智层/QQ 桥接）在禁止名单里，关不掉。',
      '用法：name 填 plugins_list 里的 entryId（比如 "launcher"、"news"），enabled 填 true/false。',
      '用完记得关回去——开着就一直在占提示词。',
    ].join('\n'),
    parameters: {
      name: { type: 'string', required: true, description: '插件 entryId（或模块名里的唯一一段）' },
      enabled: { type: 'boolean', required: true, description: 'true 打开 / false 关掉' },
    },
    output: { schema: RESULT, render },
    async execute(args, exec) {
      try {
        if (!isOwner(exec)) return { ok: false, message: '开关插件只允许主人在私聊里用。' }
        const target = String(args.name ?? '').trim()
        if (target === '') return { ok: false, message: '要给一个插件名字。' }
        const all = await rows()
        const found = all.filter((r) => String(r.entryId) === target || String(r.moduleName) === target)
        const fuzzy = found.length > 0 ? found : all.filter((r) => `${r.entryId} ${r.moduleName}`.toLowerCase().includes(target.toLowerCase()))
        if (fuzzy.length === 0) return { ok: false, message: `没找到叫「${target}」的插件，先用 plugins_list 看看。` }
        if (fuzzy.length > 1) {
          return { ok: false, message: `「${target}」匹配到 ${fuzzy.length} 个：${fuzzy.slice(0, 5).map((r) => r.entryId).join('、')}，说得更具体一点。` }
        }
        const row = fuzzy[0]
        if (hit(row, config.deny)) return { ok: false, message: `${row.entryId} 是核心插件，关掉她就不工作了，不给动。` }
        if (!hit(row, config.allow)) return { ok: false, message: `${row.entryId} 不在允许名单里（要开就把名字加进 dafeiyu-plugins 的 allow 配置）。` }
        const m = manager()
        if (m?.setPluginEnabled === undefined) return { ok: false, message: '插件管理器没接上，改不了。' }
        const r = await m.setPluginEnabled({ target: row.entryId, enabled: args.enabled === true })
        const state = args.enabled === true ? '打开' : '关掉'
        log('info', `${state} ${row.entryId}：${JSON.stringify(r ?? {}).slice(0, 120)}`)
        return { ok: true, message: `${row.entryId} 已经${state}了。${args.enabled === true ? '' : '它的工具下一轮就不占提示词了。'}` }
      } catch (e) {
        return { ok: false, message: '改不动：' + errText(e) }
      }
    },
  })

  const defs = [listTool, switchTool]
  const equip = (agent) => {
    const tools = agent?.ctx?.tools
    if (tools?.register === undefined) return
    for (const def of defs) {
      try {
        tools.register(def)
      } catch (e) {
        log('warn', '注册工具失败: ' + errText(e))
      }
    }
  }
  ctx.on('agent/created', (payload) => equip(payload?.agent))
  ctx.effect(() => {
    for (const agent of ctx.get('agents')?.list?.() ?? []) equip(agent)
    return () => {}
  })
  console.log('[dafeiyu-plugins] tools ready, 2 个工具（plugins_list / plugins_switch）')
}
