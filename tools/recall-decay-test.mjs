// 记忆衰减自测：验证「重要性衰减到底 + 只是弱相关 → 不注入」和「trust 低排后面」。
import assert from 'node:assert/strict'
import { effectiveImportance, recall } from '/tmp/recalltest/recall.js'

const DAY = 86_400_000
let n = 0
const ok = (c, m) => { assert.ok(c, m); n += 1 }

// 1. 半衰期：30 天掉一半
const now = Date.UTC(2026, 10, 1)
const m0 = { id: 1, scope: 'master:1:private', kind: 'fact', content: '主人喜欢草莓', importance: 1, trust: 1, createdAt: now, lastRecalled: now }
ok(Math.abs(effectiveImportance(m0, 30, now) - 1) < 1e-9, '刚想起时重要性不变')
ok(Math.abs(effectiveImportance(m0, 30, now + 30 * DAY) - 0.5) < 1e-6, '30 天后剩一半')
ok(effectiveImportance(m0, 30, now + 180 * DAY) < 0.05, '半年后几乎为零')

// 假 store：active / keywordIndex / embeddings
// 关键词索引要的是 { docs: Map<id, Set<token>>, df: Map<token, count> }，按真实形状造。
const { buildIndex } = await import('/tmp/recalltest/text.js')
const mkStore = (rows) => ({
  active: () => rows,
  keywordIndex: () => buildIndex(rows),
  embeddings: () => new Map(),
})
const S = (over = {}) => ({ topK: 10, keywordThreshold: 0.0, keywordWeight: 1, importanceWeight: 0.2, recencyWeight: 0.1, groupDiscount: 0.7, halfLifeDays: 30, importanceFloor: 0.12, floorRelevance: 0.6, ...over })

// 2. 很久没想起 + 弱相关 → 被地板挡掉
const old = { id: 2, scope: 'master:1:private', kind: 'fact', content: '很久以前的一条', importance: 1, trust: 1, createdAt: now - 300 * DAY, lastRecalled: now - 300 * DAY }
const fresh = { id: 3, scope: 'master:1:private', kind: 'fact', content: '最近的一条', importance: 1, trust: 1, createdAt: now, lastRecalled: now }
let out = recall(mkStore([old, fresh]), { category: 'master', umo: 'master:1' }, '完全不相干的查询词', S({ keywordThreshold: 0 }), undefined, now)
ok(out.every((r) => r.memory.id !== 2), '衰减到底 + 弱相关 → 不注入')
ok(out.some((r) => r.memory.id === 3), '新鲜的照样注入')

// 3. 同样很久没想起，但强相关 → 照样注入（不能把重要事实丢掉）
const oldRelevant = { ...old, id: 6, content: '主人喜欢草莓' }
const store2 = {
  active: () => [oldRelevant],
  keywordIndex: () => buildIndex([oldRelevant]),
  embeddings: () => new Map(),
}
out = recall(store2, { category: 'master', umo: 'master:1' }, '主人喜欢草莓', S({ keywordThreshold: 0 }), undefined, now)
ok(out.some((r) => r.memory.id === 6), '强相关时不受衰减地板影响')

// 4. trust 低 → 分数更低（排后面）
const hi = { id: 4, scope: 'master:1:private', kind: 'fact', content: 'a', importance: 1, trust: 1, createdAt: now, lastRecalled: now }
const lo = { id: 5, scope: 'master:1:private', kind: 'fact', content: 'a', importance: 1, trust: 0.1, createdAt: now, lastRecalled: now }
out = recall(mkStore([hi, lo]), { category: 'master', umo: 'master:1' }, 'a', S({ keywordThreshold: 0 }), undefined, now)
ok(out[0].memory.id === 4 && out[1].memory.id === 5, 'trust 高的排前面')
ok(out[0].score > out[1].score, 'trust 低分数确实更低')

// 5. 关掉地板（importanceFloor=0）时老的也能进来
out = recall(mkStore([old, fresh]), { category: 'master', umo: 'master:1' }, '完全不相干的查询词', S({ keywordThreshold: 0, importanceFloor: 0 }), undefined, now)
ok(out.some((r) => r.memory.id === 2), 'importanceFloor=0 时不淘汰')

console.log(`记忆衰减自测：${n} 项全过 ✅`)
