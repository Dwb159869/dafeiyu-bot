// 每日预算：B 站请求 / 精读篇数 / 取稿 token
export const DEFAULT_BUDGET = { requestsPerDay: 800, readsPerDay: 3, tokensPerDay: 200000 }

export function remaining(usage, budget = DEFAULT_BUDGET) {
  return {
    requests: Math.max(0, budget.requestsPerDay - (usage.requests || 0)),
    reads: Math.max(0, budget.readsPerDay - (usage.reads || 0)),
    tokens: Math.max(0, budget.tokensPerDay - (usage.tokens || 0)),
  }
}

export function canRead(usage, budget = DEFAULT_BUDGET) {
  const r = remaining(usage, budget)
  if (r.reads <= 0) return { ok: false, reason: `今天已精读 ${budget.readsPerDay} 篇` }
  if (r.tokens <= 0) return { ok: false, reason: '今天的取稿额度用完了' }
  if (r.requests <= 0) return { ok: false, reason: '今天的请求额度用完了' }
  return { ok: true, reason: '' }
}

export function clampTokens(text, limit) {
  const s = String(text || '')
  return s.length <= limit ? s : s.slice(0, limit) + '\n…（后面还有，先看这些）'
}
