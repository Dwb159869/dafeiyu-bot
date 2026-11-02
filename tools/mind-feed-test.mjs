// 取稿端压缩自测：node tools/mind-feed-test.mjs
import { compressSubtitle } from '/home/example/dafeiyu-linux/plugins/dsh-dafeiyu-mind/lib/feed/bili.js'

let pass = 0
let fail = 0
function ok(name, cond, extra = '') {
  if (cond) { pass++; console.log('  ✓ ' + name) }
  else { fail++; console.log('  ✗ ' + name + (extra ? ' → ' + extra : '')) }
}
const tok = (t) => Math.ceil(Buffer.byteLength(String(t || ''), 'utf8') / 3)

const short = '[00:01] 你好\n[00:03] 今天讲三件事'
const s1 = compressSubtitle(short, { limitTokens: 2500 })
ok('短字幕原样返回', s1.dropped === 0 && s1.text === short)

const lines = Array.from({ length: 600 }, (_, i) => `[${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}] 这一句字幕用来测试抽样，内容大概二十来个字左右。`)
const full = lines.join('\n')
const c = compressSubtitle(full, { limitTokens: 2500 })
ok('长字幕被压缩', c.dropped > 0 && c.kept < c.total, `kept=${c.kept} total=${c.total}`)
ok('压完在预算内', tok(c.text) <= 2500, `tokens=${tok(c.text)}`)
ok('保留开头', c.text.startsWith(lines[0]))
ok('保留结尾', c.text.trimEnd().endsWith(lines[lines.length - 1]))
ok('保留时间轴形状', /^\[\d\d:\d\d\]/m.test(c.text))
ok('空输入不炸', compressSubtitle('', { limitTokens: 100 }).text === '')

console.log(`\n${pass} 通过 / ${fail} 失败`)
process.exit(fail === 0 ? 0 : 1)
