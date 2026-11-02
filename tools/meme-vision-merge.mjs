#!/usr/bin/env node
// 把逐张看图的标注（一行一个 JSON，字段 rel/note/tags/cat）合并进 02资料库/表情包/视觉标注.json。
// 用法：node tools/meme-vision-merge.mjs /tmp/meme-notes/*.jsonl
// 合并完要再跑 node tools/meme-reindex.mjs 才会进索引。
import fs from 'node:fs';
import path from 'node:path';
import { TAXONOMY } from './meme-taxonomy.mjs';

const LIB = process.env.MEME_ROOT || path.join(process.env.HOME || '/home/example', 'dafeiyu-linux/大肥鱼小窝/02资料库/表情包');
const OUT = path.join(LIB, '视觉标注.json');

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('用法：node tools/meme-vision-merge.mjs <标注文件.jsonl...>');
  process.exit(1);
}

let existing = {};
try {
  existing = JSON.parse(fs.readFileSync(OUT, 'utf8'));
} catch {
  existing = {};
}
let added = 0;
let updated = 0;
let skipped = 0;
const cats = new Set(Object.keys(TAXONOMY));

for (const file of files) {
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const raw = line.trim().replace(/^```(?:json)?/, '').replace(/```$/, '').trim();
    if (!raw) continue;
    let item;
    try {
      item = JSON.parse(raw);
    } catch {
      skipped += 1;
      continue;
    }
    const rel = String(item.rel ?? '').replace(/^\/+/, '').trim();
    if (!rel || !fs.existsSync(path.join(LIB, rel))) {
      skipped += 1;
      continue;
    }
    const note = String(item.note ?? '').trim().slice(0, 60);
    const tags = (Array.isArray(item.tags) ? item.tags : [])
      .map((t) => String(t).trim())
      .filter((t) => t.length > 0 && t.length <= 12)
      .slice(0, 6);
    const cat = cats.has(String(item.cat ?? '').trim()) ? String(item.cat).trim() : undefined;
    if (!note) {
      skipped += 1;
      continue;
    }
    const prev = existing[rel];
    existing[rel] = { note, tags, cat };
    if (prev) updated += 1;
    else added += 1;
  }
}

fs.writeFileSync(OUT, JSON.stringify(existing, null, 1) + '\n', 'utf8');
console.log(`视觉标注：新增 ${added} 条，更新 ${updated} 条，跳过 ${skipped} 条，共 ${Object.keys(existing).length} 条`);
console.log('下一步：node tools/meme-reindex.mjs');
