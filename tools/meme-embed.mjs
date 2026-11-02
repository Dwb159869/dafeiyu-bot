#!/usr/bin/env node
// 给表情包算语义向量（bge-m3），让「主人夸我聪明」这种没命中关键词的话也能找到对味的图。
// 用法：node tools/meme-embed.mjs [--force]
// 输出：02资料库/表情包/语义向量.json
import fs from 'node:fs';
import path from 'node:path';

const LIB = process.env.MEME_ROOT || path.join(process.env.HOME || '/home/example', 'dafeiyu-linux/大肥鱼小窝/02资料库/表情包');
const INDEX = path.join(LIB, '索引.json');
const OUT = path.join(LIB, '语义向量.json');
const API = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const MODEL = process.env.EMBED_MODEL || 'bge-m3';
const force = process.argv.includes('--force');

const index = JSON.parse(fs.readFileSync(INDEX, 'utf8'));
let store = { model: MODEL, dim: 0, items: {} };
if (!force && fs.existsSync(OUT)) store = JSON.parse(fs.readFileSync(OUT, 'utf8'));

const embed = async (text) => {
  const res = await fetch(`${API}/api/embeddings`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, prompt: text }),
  });
  if (!res.ok) throw new Error(`embedding ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data.embedding)) throw new Error('embedding 格式不对');
  return data.embedding;
};

const textOf = (img) => [img.cat, img.note, ...(img.tags ?? [])].filter(Boolean).join(' ');

const todo = index.images.filter((img) => force || !store.items[img.rel]);
console.log(`需要算向量：${todo.length} / ${index.images.length}`);
let done = 0;
for (const img of todo) {
  const vec = await embed(textOf(img));
  store.items[img.rel] = vec.map((v) => Number(v.toFixed(5)));
  store.dim = vec.length;
  done += 1;
  if (done % 20 === 0) console.log(`  ${done}/${todo.length}`);
}
// 清理已不存在的图
const live = new Set(index.images.map((i) => i.rel));
for (const rel of Object.keys(store.items)) if (!live.has(rel)) delete store.items[rel];
fs.writeFileSync(OUT, JSON.stringify(store), 'utf8');
console.log(`已写入 ${OUT}：${Object.keys(store.items).length} 张，维度 ${store.dim}，${(fs.statSync(OUT).size / 1024).toFixed(0)}KB`);
