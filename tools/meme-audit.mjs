#!/usr/bin/env node
// 表情库体检：看分类分布、抽样每类 3 条（cat / note / tags），并列出可疑项。
import fs from 'node:fs';
import path from 'node:path';

const LIB = process.env.MEME_ROOT || path.join(process.env.HOME || '/home/example', 'dafeiyu-linux/大肥鱼小窝/02资料库/表情包');
const idx = JSON.parse(fs.readFileSync(path.join(LIB, '索引.json'), 'utf8'));
const imgs = idx.images ?? [];

const byCat = new Map();
for (const i of imgs) {
  if (!byCat.has(i.cat)) byCat.set(i.cat, []);
  byCat.get(i.cat).push(i);
}

console.log(`总数 ${imgs.length}，${byCat.size} 类`);
const rows = [...byCat.entries()].sort((a, b) => b[1].length - a[1].length);
for (const [cat, list] of rows) {
  const vis = list.filter((x) => x.vision).length;
  console.log(`  ${cat.padEnd(4)} ${String(list.length).padStart(4)} 张（看过图 ${vis}）`);
}

const only = process.argv[2];
console.log('\n抽样：');
for (const [cat, list] of rows) {
  if (only && cat !== only) continue;
  const pick = list.slice(0, 3);
  console.log(`\n[${cat}]`);
  for (const i of pick) console.log(`  ${i.rel.split('/').pop()} ｜ ${i.note}`);
}

const suspicious = imgs.filter((i) => !i.vision && !i.manual);
if (suspicious.length > 0) {
  console.log(`\n没看过图、也没人工归类的：${suspicious.length} 张`);
  for (const i of suspicious.slice(0, 10)) console.log(`  ${i.rel} → ${i.cat}`);
}
