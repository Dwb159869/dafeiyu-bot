// 唯一的发言出口：能不能现在主动找他
// 把原来 life 的闸门与 bili-whale 的 mention 合成一处

export function inQuiet(nowMs, timeZone, quietStart, quietEnd) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(nowMs))
  const hh = Number(parts.find((p) => p.type === 'hour')?.value || 0)
  const mm = Number(parts.find((p) => p.type === 'minute')?.value || 0)
  const cur = hh * 60 + mm
  const [sh, sm] = String(quietStart).split(':').map(Number)
  const [eh, em] = String(quietEnd).split(':').map(Number)
  const start = (sh || 0) * 60 + (sm || 0)
  const end = (eh || 0) * 60 + (em || 0)
  if (start === end) return false
  return start < end ? cur >= start && cur < end : cur >= start || cur < end
}

/**
 * @param {object} p
 * @param {number} p.now
 * @param {string} p.umo
 * @param {string} p.timeZone
 * @param {{quietStart:string,quietEnd:string,minGapMinutes:number,recentMinutes:number,capPerDay:number,kindCooldownHours:number}} p.cfg
 * @param {{lastIn?:number|null,lastFire?:number|null,lastKind?:string|null,lastKindAt?:number|null,firesToday:number,isOwner:boolean}} p.s
 * @param {'proactive'|'mention'} p.channel
 */
export function canSpeak(p) {
  const { now, timeZone, cfg, s, channel } = p
  if (inQuiet(now, timeZone, cfg.quietStart, cfg.quietEnd)) return { ok: false, reason: '免打扰时段' }
  if (!s.isOwner && channel === 'proactive') return { ok: false, reason: '不是主人' }
  if (s.lastIn && now - s.lastIn < cfg.recentMinutes * 60000) return { ok: false, reason: '刚聊过' }
  if (s.lastFire && now - s.lastFire < cfg.minGapMinutes * 60000) return { ok: false, reason: '距上次主动太近' }
  if (channel === 'mention' && s.firesToday >= cfg.mentionCapPerDay) return { ok: false, reason: '今天 @ 次数用完' }
  if (channel === 'proactive' && s.firesToday >= cfg.capPerDay) return { ok: false, reason: '今天主动次数用完' }
  return { ok: true, reason: '' }
}

export function kindOnCooldown(s, kind, now, hours) {
  if (!s?.lastKind || s.lastKind !== kind || !s.lastKindAt) return false
  return now - s.lastKindAt < hours * 3600000
}
