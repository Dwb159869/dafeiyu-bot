// 换气：发现「同一个工具、同样的参数」在打转时，提醒她先停一下。
// 来自 dsh-agent-soul v2 的 huanqi 思路，但这里不删任何东西——只数次数、只插一句话。
// 纯函数，不碰 IO，方便自测。

/** 把参数压成可比较的形状：空白归一、长数字/长十六进制（时间戳、pid、sha）抹掉。 */
export function argsKey(raw) {
  const s = String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  return s
    .replace(/\b\d{6,}\b/g, '#')
    .replace(/[0-9a-f]{12,}/gi, '#')
    .slice(0, 300)
}

export const DEFAULT_BREATHE = {
  enabled: true,
  threshold: 3, // 同样参数第 3 次开始提醒
  windowMs: 15 * 60 * 1000, // 只在 15 分钟内的重复才算打转
  quietMs: 30 * 60 * 1000, // 提醒过之后，同一个 key 半小时内不再吵
}

export class BreatheTracker {
  constructor(opts = {}) {
    this.cfg = { ...DEFAULT_BREATHE, ...opts }
    /** @type {Map<string, {key:string, tool:string, count:number, first:number, last:number, warnedAt:number}>} */
    this.sessions = new Map()
  }

  /** 记一次工具调用。返回 {count, repeated}。 */
  note(sessionId, tool, argsText, now) {
    const id = String(sessionId ?? '')
    if (!this.cfg.enabled || id === '') return { count: 0, repeated: false }
    const key = `${tool}|${argsKey(argsText)}`
    const cur = this.sessions.get(id)
    if (!cur || cur.key !== key || now - cur.last > this.cfg.windowMs) {
      this.sessions.set(id, { key, tool: String(tool ?? ''), count: 1, first: now, last: now, warnedAt: 0 })
      return { count: 1, repeated: false }
    }
    cur.count += 1
    cur.last = now
    return { count: cur.count, repeated: cur.count >= this.cfg.threshold }
  }

  /** 要不要插一句提醒（同一个 episode 只给一次）。 */
  pending(sessionId, now) {
    const id = String(sessionId ?? '')
    if (!this.cfg.enabled) return null
    const cur = this.sessions.get(id)
    if (!cur) return null
    if (cur.count < this.cfg.threshold) return null
    if (now - cur.last > this.cfg.windowMs) return null
    if (cur.warnedAt && now - cur.warnedAt < this.cfg.quietMs) return null
    cur.warnedAt = now
    return {
      tool: cur.tool,
      count: cur.count,
      text:
        `【先停一下】你刚才用几乎一样的参数把 ${cur.tool || '同一个工具'} 跑了 ${cur.count} 次。` +
        '别再来第四遍——先回去看上一次的输出，换个问法或换个工具；要是确实卡住了，就直接跟主人说你卡在哪一步。',
    }
  }

  /** 一次新回合开始时清掉（会话里换了话题就不该继续数）。 */
  reset(sessionId) {
    this.sessions.delete(String(sessionId ?? ''))
  }

  /** 调试用。 */
  snapshot() {
    return [...this.sessions.entries()].map(([id, v]) => ({ id, ...v }))
  }
}
