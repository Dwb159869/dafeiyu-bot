#!/usr/bin/env node
// 表情包检索自测：对一批真实情绪短语跑排序，看看命中类别对不对、候选够不够、会不会总是同一张。
// 用法：node tools/meme-search-test.mjs
import fs from 'node:fs';
import path from 'node:path';
import { pickBest, rankMemes, suggestCategories } from '../plugins/dsh-dafeiyu-vault/lib/meme-ranking.js';

const HOME = process.env.HOME || '/home/example';
const MEME_DIR = process.env.MEME_ROOT || path.join(HOME, 'dafeiyu-linux/大肥鱼小窝/02资料库/表情包');
const index = JSON.parse(fs.readFileSync(path.join(MEME_DIR, '索引.json'), 'utf8'));
index.images = index.images.map((img) => ({ ...img, abs: path.join(MEME_DIR, img.rel) }));

const CASES = [
  ['开心', '今天发工资了嘿嘿'],
  ['害羞', '被主人夸好看'],
  ['贴贴', '想你了 抱抱'],
  ['撒娇', '不给我买就赖着不走'],
  ['生气', '你又不理我'],
  ['委屈', '我是不是很没用'],
  ['疑惑', '等一下 我没听懂'],
  ['惊讶', '什么 真的假的'],
  ['困倦', '好困 眼睛睁不开了'],
  ['应答', '好的 收到'],
  ['招呼', '我回来啦'],
  ['恰饭', '饿了 想吃饭'],
  ['算力', 'token 又不够用了'],
  ['上班', '加班写代码中'],
  ['整活', '又出新模型了'],
  ['形象', '看看你长什么样'],
  ['娱乐', '一起打游戏吗'],
  ['', ''],
  ['', '上班偷偷摸鱼'],
  ['', '摸摸头'],
];

let problems = 0;
for (const [cat, query] of CASES) {
  const ranked = rankMemes(index, query, cat);
  const top = ranked.slice(0, 5);
  if (top.length === 0) {
    const alt = suggestCategories(index, cat);
    console.log(`${cat.padEnd(3, '　')} 「${query}」 → 无候选（可退到：${alt.join('、')}）`);
    if (index.categories.find((c) => c.cat === cat)?.count > 0) problems += 1;
    continue;
  }
  const cats = [...new Set(top.map((x) => x.img.cat))];
  const misHit = cat ? cats.filter((c) => c !== cat) : [];
  console.log(`${cat.padEnd(3, '　')} 「${query}」 → ${top.length} 候选，类别 ${cats.join('/')}${misHit.length > 0 ? ' ⚠ 混入 ' + misHit.join('/') : ''}`);
}
console.log(problems === 0 ? '基本全覆盖，没有空命中。' : `有 ${problems} 个有图分类检索不到，需要补关键词。`);

// 是否总在同一张：故意连要 20 次「开心」，看最高分池多大、实际落到几张
{
  const usage = [];
  const picks = [];
  let pool = 0;
  for (let i = 0; i < 20; i++) {
    const ranked = rankMemes(index, '开心', '开心');
    if (ranked.length === 0) break;
    const top = ranked.filter((x) => x.score === ranked[0].score).length;
    pool = top;
    const img = pickBest(ranked, usage, 'test-session');
    if (img === null) break;
    picks.push(img.rel);
    usage.push({ t: new Date().toISOString(), rel: img.rel, session: 'test-session' });
  }
  console.log(`连要 20 次「开心」：最高分池 ${pool} 张，实际用到 ${new Set(picks).size} 张（允许重复，优先贴合度）`);
}
