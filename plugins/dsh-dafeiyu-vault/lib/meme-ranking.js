// 表情包检索的纯函数：分类匹配 + 排序 + 兜底建议。
// 单独成文件，一是插件里更清爽，二是 tools/meme-search-test.mjs 可以不起插件依赖直接测。
export const normText = (s) => String(s ?? '').toLowerCase().trim();
/** 一句话 → 命中的分类（含每个分类的触发词和近义词） */
export const hitCategories = (index, text) => {
  const t = normText(text);
  const hits = new Set();
  if (!t) return hits;
  for (const [cat, meta] of Object.entries(index.taxonomy ?? {})) {
    if (t.includes(cat)) hits.add(cat);
    for (const kw of meta.kw ?? []) if (String(kw).length >= 2 && t.includes(normText(kw))) hits.add(cat);
  }
  return hits;
};
export const cosine = (a, b) => {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na > 0 && nb > 0 ? dot / Math.sqrt(na * nb) : 0;
};

export const rankMemes = (index, query, category, opts = {}) => {
  const t = normText(query);
  const cat = String(category ?? '').trim();
  const known = cat !== '' && index.taxonomy?.[cat] !== undefined;
  const catCount = (index.categories ?? []).find((c) => c.cat === cat)?.count ?? 0;
  // 明确点名了分类但一张都没有：不拿别的情绪凑数，交给调用方换类别
  if (known && catCount === 0) return [];
  const restrict = known && catCount > 0;
  const hits = restrict ? new Set([cat]) : hitCategories(index, (cat ? cat + ' ' : '') + t);
  const vectors = opts.vectors ?? null;
  const queryVec = opts.queryVec ?? null;
  const tokens = t.split(/[\s,，、/]+/).filter((x) => x.length >= 2);
  const scored = [];
  for (const img of index.images ?? []) {
    if (restrict && img.cat !== cat) continue;
    let score = 0;
    if (cat !== '' && img.cat === cat) score += 12;
    else if (hits.has(img.cat)) score += 8;
    const tags = (img.tags ?? []).map(normText);
    const noteText = normText(img.note ?? '');
    const hay = normText([img.cat, img.note, img.src, ...tags].join(' '));
    for (const tok of tokens) {
      if (noteText.includes(tok)) score += 3;
      else if (hay.includes(tok)) score += 2;
    }
    for (const tag of tags) if (tag.length >= 2 && t.includes(tag)) score += 3;
    // 4) 语义相似度：关键词没打中的说法靠它兜住（「主人夸我聪明」这类）
    let sim = 0;
    if (vectors !== null && queryVec !== null && Array.isArray(vectors.items?.[img.rel])) {
      sim = cosine(queryVec, vectors.items[img.rel]);
      if (sim > 0.35) score += (sim - 0.35) * 18;
    }
    score = Math.round(score);
    if (score > 0) scored.push({ img, score, sim });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored;
};
export const suggestCategories = (index, category) => {
  const have = (index.categories ?? []).filter((c) => (c.count ?? 0) > 0);
  const near = index.taxonomy?.[category]?.near ?? [];
  const picks = have.filter((c) => near.includes(c.cat));
  const list = picks.length > 0 ? picks : have.slice(0, 4);
  return list.map((c) => `${c.cat}（${c.count} 张）`);
};

/**
 * 从排好序的候选里挑一张：以"最贴切"为准，最高分同分里随机。
 * 同会话刚用过的只在同分时让一手，绝不为了不出重图而牺牲匹配度。
 */
export const pickBest = (ranked, usage = [], sessionId = '', opts = {}) => {
  if (!Array.isArray(ranked) || ranked.length === 0) return null;
  // 不要求分数完全相等：同一个分数带里都算「一样贴切」，否则通用情绪（比如只给类别名）永远只有一张能中
  const band = Number(opts.band ?? 2);
  const top = ranked[0].score;
  const pool = ranked.filter((x) => x.score >= top - band);
  if (pool.length === 1) return pool[0].img;
  // 先躲开本会话最近 8 次发过的，再躲开全局最近 3 次发过的；都不行就随机（贴情绪比不撞图重要）
  const recentSession = new Set(usage.filter((u) => u.session === sessionId).slice(-8).map((u) => u.rel));
  const recentAny = new Set(usage.slice(-3).map((u) => u.rel));
  const freshSession = pool.filter((x) => !recentSession.has(x.img.rel));
  const base = freshSession.length > 0 ? freshSession : pool;
  const freshAny = base.filter((x) => !recentAny.has(x.img.rel));
  const candidates = freshAny.length > 0 ? freshAny : base;
  return candidates[Math.floor(Math.random() * candidates.length)].img;
};
