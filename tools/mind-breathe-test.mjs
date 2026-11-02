// 换气自测：数重复、只提醒一次、换参数/换会话要重置、过期不再算
import assert from 'node:assert/strict'
import { BreatheTracker, argsKey, DEFAULT_BREATHE } from '/home/example/dafeiyu-linux/plugins/dsh-dafeiyu-mind/lib/mind/breathe.js'

let n = 0
const ok = (cond, msg) => {
  assert.ok(cond, msg)
  n += 1
}

// 1. 参数归一：空白、长数字、长十六进制
ok(argsKey('  ls   -la\n/tmp  ') === 'ls -la /tmp', '空白归一')
ok(argsKey('curl "http://x/?t=1793537551594"') === 'curl "http://x/?t=#"', '长数字被抹')
ok(argsKey('sha 655a87bd18bfb025824904aa') === 'sha #', '长十六进制被抹')
ok(argsKey('') === '', '空参数')

// 2. 同样的调用第 3 次才算打转
const t = new BreatheTracker({ threshold: 3, windowMs: 60000 })
let now = 1_000_000
ok(t.note('s1', 'bash', 'ls', now).count === 1, '第一次 1')
ok(t.note('s1', 'bash', 'ls', (now += 1000)).repeated === false, '第二次还不提醒')
const third = t.note('s1', 'bash', 'ls', (now += 1000))
ok(third.count === 3 && third.repeated === true, '第三次算打转')

// 3. pending 只给一次
const warn = t.pending('s1', (now += 1000))
ok(warn && /bash/.test(warn.tool) && warn.count === 3, 'pending 给出提醒')
ok(/先停一下/.test(warn.text) && /3 次/.test(warn.text), '提醒文案含次数')
ok(t.pending('s1', (now += 1000)) === null, '同一个 episode 不再重复提醒')

// 4. 换参数 → 重新计数，旧提醒不生效
const t2 = new BreatheTracker({ threshold: 3, windowMs: 60000 })
let n2 = 2_000_000
t2.note('s2', 'bash', 'ls', n2)
t2.note('s2', 'bash', 'ls', (n2 += 1000))
ok(t2.note('s2', 'bash', 'pwd', (n2 += 1000)).count === 1, '换了参数从 1 开始')
ok(t2.pending('s2', (n2 += 1000)) === null, '换参数后不该提醒')

// 5. 会话隔离
const t3 = new BreatheTracker({ threshold: 2, windowMs: 60000 })
let n3 = 3_000_000
t3.note('a', 'read', 'x', n3)
t3.note('b', 'read', 'x', (n3 += 100))
ok(t3.pending('a', (n3 += 100)) === null, 'a 只调了 1 次不提醒')
ok(t3.pending('b', (n3 += 100)) === null, 'b 只调了 1 次不提醒')
t3.note('a', 'read', 'x', (n3 += 100))
ok(t3.pending('a', (n3 += 100)) !== null, 'a 第 2 次提醒')

// 6. 窗口过期：超过 windowMs 的重复不算连续
const t4 = new BreatheTracker({ threshold: 2, windowMs: 10_000 })
let n4 = 4_000_000
t4.note('s4', 'bash', 'ls', n4)
ok(t4.note('s4', 'bash', 'ls', (n4 += 60_000)).count === 1, '隔太久重新数')

// 7. 关掉开关就不数
const t5 = new BreatheTracker({ enabled: false })
ok(t5.note('s5', 'bash', 'ls', 5_000_000).count === 0, '关掉后不计数')
ok(t5.pending('s5', 5_000_000) === null, '关掉后不提醒')

// 8. reset 之后重新开始
const t6 = new BreatheTracker({ threshold: 2 })
let n6 = 6_000_000
t6.note('s6', 'bash', 'ls', n6)
t6.reset('s6')
ok(t6.note('s6', 'bash', 'ls', (n6 += 100)).count === 1, 'reset 后重新数')

// 9. 默认值
ok(DEFAULT_BREATHE.threshold === 3 && DEFAULT_BREATHE.enabled === true, '默认阈值 3 且开启')

console.log(`换气自测：${n} 项全过 ✅`)
