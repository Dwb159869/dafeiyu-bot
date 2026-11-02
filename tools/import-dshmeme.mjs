#!/usr/bin/env node
// 把 dsh-meme 的 dafeiyu-001 图库（24 张）并入 vault 表情库
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const SRC = '/home/example/.dsh/profiles/web/plugins/dsh-meme/memes/dafeiyu-001';
const OUT = '/home/example/dafeiyu-linux/大肥鱼小窝/02资料库/表情包/dsh-meme-大肥鱼';
const MAP = {
  happy: '开心', angry: '生气', daily: '恰饭', sad: '委屈', shy: '害羞', love: '贴贴',
  sleep: '困倦', greeting: '招呼', confused: '疑惑', cpu: '整活', money: '算力',
  work: '上班', praise: '应答', refuse: '应答', peek: '撒娇', baka: '整活', color: '整活',
  shock: '惊讶', faint: '困倦', lazy: '困倦', fear: '委屈', sorry: '应答', thanks: '应答', idle: '待归类',
};
await mkdir(OUT, { recursive: true });
const db = new DatabaseSync(join(SRC, 'index.db'));
const rows = db.prepare('select path, tag, caption, keywords from memes').all();
const out = [];
for (const r of rows) {
  const file = basename(r.path);
  const dest = join(OUT, file);
  await copyFile(join(SRC, r.path), dest);
  out.push({
    rel: `dsh-meme-大肥鱼/${file}`,
    cat: MAP[r.tag] || '待归类',
    note: r.caption || r.keywords || '',
    tags: (r.keywords || '').split(/\s+/).filter(Boolean).slice(0, 8),
    pack: 'dsh-meme-大肥鱼',
    pack_name: '大肥鱼 chibi 表情包（dsh-meme dafeiyu-001）',
    source: 'dsh-meme',
  });
}
await writeFile(join(OUT, 'meta.json'), JSON.stringify({ source: 'dsh-meme 0.1.72 / dafeiyu-001', count: out.length, items: out }, null, 1));
console.log(`导入 ${out.length} 张`);
