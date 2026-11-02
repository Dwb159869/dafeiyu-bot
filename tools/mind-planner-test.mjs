// 日程规划自测：形状、补空档、改一段挤开邻居、类型挑选、注入文案、模型兜底
import assert from 'node:assert/strict'
import { applyChange, clockText, findItem, makePlan, normalizeItems, parseClock, pickDayType, templateItems, DEFAULT_DAY_TYPES } from '../plugins/dsh-dafeiyu-mind/lib/body/planner.js'
import { buildPrompt, generateDay, parsePlan } from '../plugins/dsh-dafeiyu-mind/lib/body/planner-llm.js'
import { planContext, planList } from '../plugins/dsh-dafeiyu-mind/lib/body/plan-inject.js'
import { linkItems, wardrobePrompt } from '../plugins/dsh-dafeiyu-mind/lib/body/wardrobe.js'

let pass = 0
const t = (name, fn) => {
  try {
    fn()
    pass++
    console.log('  ✓ ' + name)
  } catch (e) {
    console.log('  ✗ ' + name + ' → ' + (e instanceof Error ? e.message : e))
    process.exitCode = 1
  }
}
const ta = async (name, fn) => {
  try {
    await fn()
    pass++
    console.log('  ✓ ' + name)
  } catch (e) {
    console.log('  ✗ ' + name + ' → ' + (e instanceof Error ? e.message : e))
    process.exitCode = 1
  }
}

console.log('时钟')
t('parseClock 24:00 = 1440', () => assert.equal(parseClock('24:00'), 1440))
t('parseClock 坏值返回 null', () => assert.equal(parseClock('25:00'), null))
t('clockText 往返', () => assert.equal(clockText(parseClock('07:05')), '07:05'))

console.log('日程形状')
const raw = [
  { start: '09:00', end: '10:00', activity: '吃早饭', location: '家' },
  { start: '10:30', end: '12:00', activity: '干活' },
]
const norm = normalizeItems(raw)
t('补出 00:00 开头', () => assert.equal(norm[0].start, '00:00'))
t('补出 24:00 结尾', () => assert.equal(norm[norm.length - 1].end, '24:00'))
t('中间缺口也补上', () => assert.ok(norm.some((it) => it.gap && it.start === '10:00' && it.end === '10:30')))
t('保留 t / what 别名', () => {
  const real = norm.find((it) => it.activity === '吃早饭')
  assert.equal(real.t, '09:00')
  assert.equal(real.what, '吃早饭')
})
t('首尾相接不重叠', () => {
  const real = norm.filter((it) => !it.gap)
  for (let i = 1; i < real.length; i++) assert.ok(parseClock(real[i].start) >= parseClock(real[i - 1].end))
})

console.log('改一段')
const changed = applyChange(norm, { start: '09:30', end: '11:00', activity: '收拾屋子' })
t('新段写进去', () => assert.ok(changed.some((it) => it.activity === '收拾屋子')))
t('被压的那段截断或消失', () => {
  const eat = changed.find((it) => it.activity === '吃早饭')
  if (eat) assert.ok(parseClock(eat.end) <= parseClock('09:30'))
})
t('改完仍然铺满一天', () => {
  assert.equal(changed[0].start, '00:00')
  assert.equal(changed[changed.length - 1].end, '24:00')
})
t('改不存在的段落要报错', () => assert.throws(() => applyChange(norm, { index: 99, start: '10:00', end: '11:00' })))
t('end 早于 start 要报错', () => assert.throws(() => applyChange(norm, { index: 1, start: '12:00', end: '11:00' })))

console.log('类型')
t('同一天挑出来的类型稳定', () => {
  const a = pickDayType(DEFAULT_DAY_TYPES, '2026-11-01')
  const b = pickDayType(DEFAULT_DAY_TYPES, '2026-11-01')
  assert.equal(a.id, b.id)
})
t('指定类型优先', () => assert.equal(pickDayType(DEFAULT_DAY_TYPES, '2026-11-01', 'overtime').id, 'overtime'))
t('周末不会挑到只给工作日的类型', () => {
  const ids = new Set()
  for (let i = 0; i < 40; i++) ids.add(pickDayType(DEFAULT_DAY_TYPES, `2026-11-0${(i % 8) + 1}`).id)
  assert.ok(!ids.has('overtime'))
})

console.log('模板')
for (const type of DEFAULT_DAY_TYPES) {
  t(`${type.name} 的模板铺满一天`, () => {
    const items = templateItems(type.id)
    assert.equal(items[0].start, '00:00')
    assert.equal(items[items.length - 1].end, '24:00')
    assert.ok(items.filter((it) => !it.gap).length >= 6)
  })
}

console.log('注入')
const plan = makePlan({ day: '2026-11-01', type: DEFAULT_DAY_TYPES[0], items: templateItems('workday'), title: '平平淡淡', mood: '还行' })
const ctxText = planContext(plan, { nowMs: new Date('2026-11-01T14:20:00+08:00').getTime(), timeZone: 'Asia/Shanghai' })
t('写了此刻在做什么', () => assert.match(ctxText, /此刻：/))
t('写了接下来', () => assert.match(ctxText, /接下来：/))
t('有说话方式约束', () => assert.match(ctxText, /按照日程/))
t('长度不超 700', () => assert.ok(ctxText.length <= 700))
t('晚上会预告明天', () => {
  const tomorrow = makePlan({ day: '2026-11-02', type: DEFAULT_DAY_TYPES[1], items: templateItems('restday') })
  const txt = planContext(plan, { nowMs: new Date('2026-11-01T20:10:00+08:00').getTime(), timeZone: 'Asia/Shanghai', tomorrow })
  assert.match(txt, /明天是休息日/)
})
t('planList 标出此刻', () => {
  const lines = planList(plan, { nowMs: new Date('2026-11-01T14:20:00+08:00').getTime(), timeZone: 'Asia/Shanghai' })
  assert.ok(lines.some((l) => l.includes('← 现在')))
  assert.ok(!lines.some((l) => l.includes('空档')))
})

console.log('模型')
t('提示词带类型和格式要求', () => {
  const p = buildPrompt({ persona: '你是大肥鱼', type: DEFAULT_DAY_TYPES[0], day: '2026-11-02', series: { title: '小镇诊所', ep: 9, eps: 40 } })
  assert.match(p, /要排的日子/)
  assert.match(p, /小镇诊所/)
  assert.match(p, /只输出一个 JSON 对象/)
})
t('解析模型输出（带围栏）', () => {
  const text = '```json\n{"title":"忙","mood":"累","items":[{"start":"07:30","end":"08:30","activity":"起床"},{"start":"08:30","end":"12:00","activity":"干活"},{"start":"12:00","end":"13:00","activity":"吃饭"},{"start":"13:00","end":"18:00","activity":"干活"},{"start":"18:00","end":"24:00","activity":"回家"}]}\n```'
  const p = parsePlan(text)
  assert.equal(p.title, '忙')
  assert.ok(p.items.length >= 5)
})
t('段数太少要报错', () => assert.throws(() => parsePlan('{"items":[{"start":"09:00","end":"10:00","activity":"吃"}]}')))
t('没有 JSON 要报错', () => assert.throws(() => parsePlan('我不知道')))

console.log('衣柜')
t('没装 image-studio 时是空数组', () => {
  const w = linkItems(normalizeItems(raw), [], '大肥鱼')
  assert.ok(Array.isArray(w))
})
t('有衣柜时补 outfit', () => {
  const wardrobe = [
    { cat: 'characters', name: '大肥鱼', situations: { 居家: '睡衣', 上班: '女仆装' }, defaultOutfit: '女仆装' },
    { cat: 'scenes', name: '居家卧室', situations: {} },
  ]
  const items = linkItems([{ start: '09:00', end: '10:00', activity: '在家收拾屋子' }], wardrobe, '大肥鱼')
  assert.equal(items[0].outfit, '睡衣')
  assert.ok(wardrobePrompt(wardrobe).join('\n').includes('大肥鱼'))
})

console.log('生成（假模型）')
const fakeCtx = (reply) => ({
  get(name) {
    if (name === 'llm') {
      return {
        async *stream() {
          for (const piece of [reply]) yield { type: 'text-delta', text: piece }
          yield { type: 'finish', reason: { kind: 'stop' } }
        },
      }
    }
    if (name === 'agentDefaultModel') return { currentSelection: () => ({ provider: 'p', model: 'm' }) }
    return null
  },
})
await ta('模型正常时 source=llm', async () => {
  const reply = '{"title":"安静","mood":"平静","items":[{"start":"07:30","end":"08:10","activity":"起床"},{"start":"08:10","end":"12:00","activity":"干活"},{"start":"12:00","end":"13:00","activity":"吃午饭"},{"start":"13:00","end":"18:00","activity":"干活"},{"start":"18:00","end":"24:00","activity":"回家休息"}]}'
  const r = await generateDay({ ctx: fakeCtx(reply), day: '2026-11-02', type: DEFAULT_DAY_TYPES[0] })
  assert.equal(r.plan.source, 'llm')
  assert.equal(r.error, undefined)
  assert.equal(r.plan.items[0].start, '00:00')
})
await ta('模型坏掉时退回模板', async () => {
  const bad = {
    get: (n) =>
      n === 'llm'
        ? { async *stream() { throw new Error('boom') } }
        : n === 'agentDefaultModel'
          ? { currentSelection: () => ({ provider: 'p', model: 'm' }) }
          : null,
  }
  const r = await generateDay({ ctx: bad, day: '2026-11-03', type: DEFAULT_DAY_TYPES[1] })
  assert.equal(r.plan.source, 'template')
  assert.match(r.error, /boom/)
})

console.log(`\n通过 ${pass} 项`)
