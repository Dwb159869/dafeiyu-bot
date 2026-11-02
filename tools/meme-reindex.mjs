#!/usr/bin/env node
// 重建表情包索引：扫小窝里的表情包目录，按 memes_data / manifest / 文件名关键词归类，
// 输出 02资料库/表情包/索引.json（插件只读这个文件，不再靠猜文件名）。
//
// 用法：
//   node tools/meme-reindex.mjs            # 重建并写入索引
//   node tools/meme-reindex.mjs --dry      # 只统计不写文件
//   node tools/meme-reindex.mjs --verbose  # 每张图打一行归类结果
//
// 人工纠正：在 02资料库/表情包/手工归类.json 里写
//   { "deepseek-fanart-meme-pack/memes/happy/0019_sticker_bf_025.png": { "cat": "开心", "tags": ["开心","撒花"] } }
// 重建时以手工为准，不会被覆盖。
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { TAXONOMY, SLUG_MAP, STOPWORDS } from './meme-taxonomy.mjs';

const HOME = process.env.HOME || '/home/example';
const LIB = process.env.MEME_ROOT || path.join(HOME, 'dafeiyu-linux/大肥鱼小窝/02资料库/表情包');
const INDEX = path.join(LIB, '索引.json');
const MANUAL = path.join(LIB, '手工归类.json');
const VISION = path.join(LIB, '视觉标注.json');
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp']);
const DRY = process.argv.includes('--dry');
const VERBOSE = process.argv.includes('--verbose');

const CATS = Object.keys(TAXONOMY);
const slugToCat = (slug) => SLUG_MAP[String(slug ?? '').toLowerCase()] ?? null;

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fsp.readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

async function walk(dir, out, depth = 0) {
  if (depth > 5) return;
  const entries = await fsp.readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const e of entries) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) {
      // 预览图、封面目录不是表情本体
      if (/^(previews?|thumbs?|covers?)$/i.test(e.name)) continue;
      await walk(abs, out, depth + 1);
    } else if (IMAGE_EXT.has(path.extname(e.name).toLowerCase())) {
      out.push(abs);
    }
  }
}

/** 从 memes_data 的中文说明里抽 2~8 字的关键词当标签 */
function tagsFromNote(note) {
  return String(note ?? '')
    .split(/[、，。；,.;/\s或]+/)
    .map((w) => w.replace(/^(用于|用来|表示|适合)/, '').trim())
    .filter((w) => w.length >= 2 && w.length <= 8 && !STOPWORDS.has(w))
    .slice(0, 12);
}

function isAnimated(abs, ext, bytes) {
  if (ext === '.gif') return true;
  if (ext === '.webp') return bytes.includes('ANIM');
  return false;
}

function guessFromName(name) {
  const base = name.replace(/\.[^.]+$/, '').toLowerCase();
  const hits = new Set();
  for (const cat of CATS) {
    if (cat === '待归类') continue;
    for (const kw of TAXONOMY[cat].kw) {
      const k = kw.toLowerCase();
      if (k.length >= 2 && base.includes(k)) hits.add(cat);
    }
  }
  return [...hits];
}

async function main() {
  const manual = await readJson(MANUAL, {});
  const prev = await readJson(INDEX, { images: [] });
  const prevByRel = new Map((prev.images ?? []).map((x) => [x.rel, x]));

  const files = [];
  await walk(LIB, files);

  // 每个包的中文说明：manifest.json / memes_data.json
  const noteByCat = {};
  const packName = {};
  const packDirs = (await fsp.readdir(LIB, { withFileTypes: true })).filter((e) => e.isDirectory());
  for (const d of packDirs) {
    const packPath = path.join(LIB, d.name);
    const data = await readJson(path.join(packPath, 'memes_data.json'), {});
    const manifest = await readJson(path.join(packPath, 'manifest.json'), {});
    for (const [slug, note] of Object.entries(data)) {
      const cat = slugToCat(slug);
      if (cat !== null && !noteByCat[cat]) noteByCat[cat] = { note: String(note), slug };
    }
    if (manifest?.name) packName[d.name] = String(manifest.name);
  }

  const images = [];
  const stats = {};
  const vision = JSON.parse(await fsp.readFile(VISION, 'utf8').catch(() => '{}'));

  // 包自带元数据（meta.json 的 items[]：rel/cat/note/tags），优先级介于手工与看图之间
  const packMeta = {};
  for (const d of packDirs) {
    const meta = await readJson(path.join(LIB, d.name, 'meta.json'), null);
    if (Array.isArray(meta?.items)) for (const it of meta.items) if (it?.rel) packMeta[it.rel] = it;
  }

  const unclassified = [];

  for (const abs of files.sort()) {
    const rel = path.relative(LIB, abs).split(path.sep).join('/');
    const segs = rel.split('/');
    const file = segs[segs.length - 1];
    const pack = segs.length > 2 ? segs[0] : path.dirname(rel);
    const ext = path.extname(file).toLowerCase();
    const bytes = await fsp.readFile(abs).catch(() => Buffer.alloc(0));

    // 0) 手工归类最优先，其次是看图标注（视觉标注.json）
    const m = manual[rel];
    const v = vision[rel];
    const pm = packMeta[rel];
    let cat = m?.cat && CATS.includes(m.cat) ? m.cat : null;
    // 看图标注优先于包内元数据：包里的 emotion 经常和画面对不上（比如「好吃」那张其实是抽卡出金）
    if (cat === null && v?.cat && CATS.includes(v.cat)) cat = v.cat;
    if (cat === null && pm?.cat && CATS.includes(pm.cat)) cat = pm.cat;

    // 2) 目录里的分类 slug：xxx/memes/<slug>/file 或 xxx/<slug>/file
    if (cat === null) {
      const slugSeg = [...segs.slice(0, -1)].reverse().find((s) => slugToCat(s) !== null);
      if (slugSeg !== undefined) cat = slugToCat(slugSeg);
    }

    // 3) 文件名关键词兜底
    if (cat === null) {
      const guessed = guessFromName(file);
      cat = guessed[0] ?? '待归类';
    }

    const note = String(v?.note ?? pm?.note ?? '').trim() || noteByCat[cat]?.note || TAXONOMY[cat]?.desc || '';
    const tags = new Set([...(m?.tags ?? []), ...(pm?.tags ?? []), ...(v?.tags ?? [])]);
    if (!m?.tags && !v?.tags) {
      tags.add(cat);
      for (const t of tagsFromNote(note)) tags.add(t);
      for (const g of guessFromName(file)) tags.add(g);
    }
    const item = {
      rel,
      cat,
      pack,
      pack_name: packName[pack] ?? pack,
      src: file,
      format: ext.replace('.', ''),
      animated: isAnimated(abs, ext, bytes),
      bytes: bytes.length,
      note,
      tags: [...tags].slice(0, 16),
    };
    if (m) item.manual = true;
    if (v) item.vision = true;
    const old = prevByRel.get(rel);
    if (old?.added_at) item.added_at = old.added_at;
    else item.added_at = new Date().toISOString().slice(0, 10);
    if (old?.source) item.source = old.source;
    images.push(item);
    stats[cat] = (stats[cat] ?? 0) + 1;
    if (cat === '待归类') unclassified.push(rel);
    if (VERBOSE) console.log(`${cat}\t${rel}`);
  }

  const index = {
    schema_version: 2,
    generated_at: new Date().toISOString(),
    generator: 'tools/meme-reindex.mjs',
    total: images.length,
    taxonomy: TAXONOMY,
    categories: CATS.map((c) => ({
      cat: c,
      kind: TAXONOMY[c].kind,
      desc: TAXONOMY[c].desc,
      count: stats[c] ?? 0,
    })).filter((c) => c.count > 0 || !['待归类'].includes(c.cat)),
    images,
  };

  console.log('表情包目录：' + LIB);
  console.log('共 ' + images.length + ' 张：');
  for (const c of CATS) if ((stats[c] ?? 0) > 0) console.log(`  ${c.padEnd(4, '　')} ${String(stats[c]).padStart(4)}  ${TAXONOMY[c].desc}`);
  const empty = CATS.filter((c) => (stats[c] ?? 0) === 0 && c !== '待归类');
  if (empty.length > 0) console.log('空分类（等主人发新表情再长出来）：' + empty.join('、'));
  if (unclassified.length > 0) console.log('待归类：' + unclassified.length + ' 张，可写进 手工归类.json');

  if (DRY) {
    console.log('（--dry，没有写文件）');
    return;
  }
  await fsp.writeFile(INDEX, JSON.stringify(index, null, 1) + '\n', 'utf8');
  console.log('索引已写入：' + INDEX);
}

main().catch((e) => {
  console.error('重建失败：' + (e instanceof Error ? e.stack : String(e)));
  process.exitCode = 1;
});
