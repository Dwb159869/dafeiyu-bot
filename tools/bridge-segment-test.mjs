// 分段发送的拆句规则自测：node tools/bridge-segment-test.mjs
import { splitLongLine, splitReply } from '/home/example/.dsh/profiles/web/node_modules/dsh-napcat-bridge/lib/segment.js'

let pass = 0
let fail = 0
function ok(name, cond, extra = '') {
  if (cond) { pass++; console.log('  ✓ ' + name) }
  else { fail++; console.log('  ✗ ' + name + (extra ? ' → ' + extra : '')) }
}

console.log('splitLongLine')
ok('短句不拆', splitLongLine('好。').length === 1)
ok('无句号不拆', splitLongLine('啊'.repeat(200)).length === 1)
const long = '本小姐今天把图库全整理了一遍，一共五百二十一张，分成十八类，还顺手修了一个缓存的问题。那段数字每轮都变，把提示词缓存全废了，等于每轮都按全价重算。你要不要看看？我挑一张贴贴的给你，那张是伸手要抱抱的。'
ok('长句按句末标点拆', splitLongLine(long).length >= 2, JSON.stringify(splitLongLine(long)))
ok('每段不超过阈值太多', splitLongLine(long).every((s) => s.length <= 100))

console.log('splitReply')
ok('单行短回复保持一条', splitReply('好。', 10).length === 1)
ok('多行照旧拆', splitReply('第一行\n第二行\n第三行', 10).length === 3)
ok('长段落被拆成多条', splitReply(long, 10).length >= 2, JSON.stringify(splitReply(long, 10)))
ok('代码块不拆', splitReply('```js\nconst a = 1\nconst b = 2\n```', 10).length === 1)
ok('maxSegments 上限生效', splitReply(long, 2).length <= 2)
ok('空文本不炸', splitReply('   ', 10).length === 1)

console.log(`\n${pass} 通过 / ${fail} 失败`)
process.exit(fail === 0 ? 0 : 1)
