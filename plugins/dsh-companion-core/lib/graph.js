// 图记忆（关系网）：从一条条记忆里抽出人、地点、事、物和它们之间的关系，例如
//   主人 —养了→ 猫，猫 —名字→ 咪咪。
// 召回时多走一路：这条消息里提到的实体（名字直接出现，或者填了向量 Key 时名字的向量够像），
// 顺着关系走 1～2 步，把提到这些实体的记忆找出来，和原来的关键词/向量那一路按排名融合，条数不变。
// 每条记忆要多调一次模型（按批，默认一次 8 条），所以默认关。关系网存在同一个 SQLite 文件里，随备份走。
// 实体按记忆的归属分开存（主人的、每个群的、每个人私聊的），召回时只看这个会话看得到的归属。
import { embed, embedEnabled } from './embed.js';
import { complete } from './extract.js';
import { visibleScopes } from './memory.js';
import { cosine, fromBlob, normalize, toBlob } from './text.js';
const MAX_NAME = 40;
const MAX_REL = 20;
/** 一个实体被这么多条记忆提到时算"中心"（比如「主人」），不从它往外走，它带来的分数也按提到次数摊薄 */
const HUB_DEGREE = 20;
/** 名字向量相似度低于这个不算提到 */
const ENTITY_VECTOR_THRESHOLD = 0.62;
/** 最多从几个实体出发 */
const MAX_SEEDS = 8;
const cleanName = (s) => String(s ?? '').trim().replace(/\s+/g, ' ').slice(0, MAX_NAME);
/** 让模型抽关系的提示词。 */
export function graphPrompt(items) {
    return [
        '下面是你（一个陪伴型 AI）的几条记忆。请从每条里抽出提到的实体（人、动物、地点、组织、物品、事件、爱好等）和实体之间的关系。',
        '',
        '要求：',
        '- 实体名用记忆里的叫法，简短（一般 2～8 个字）；同一个人或物在不同记忆里用同一个名字。主人就写「主人」，你自己就写「我」。',
        '- 关系用简短的动词或名词（「养了」「名字是」「住在」「喜欢」「讨厌」「在…工作」「约好」「朋友」等），方向从主语到宾语。',
        '- 没有实体或关系的记忆，entities 和 relations 给空数组。不要编造记忆里没有的东西。',
        '',
        '记忆：',
        ...items.map(m => '#' + m.id + ' ' + m.content),
        '',
        '只输出一个 JSON 数组，不要别的文字。每条记忆一个元素，格式：',
        '[{"id": 12, "entities": [{"name": "咪咪", "kind": "动物"}, {"name": "主人", "kind": "人"}], "relations": [{"src": "主人", "rel": "养了", "dst": "咪咪"}]}]',
    ].join('\n');
}
/** 解析模型输出。只保留 ids 里有的记忆；关系两端不在实体里时补成实体。 */
export function parseGraph(text, ids) {
    const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
    const body = fenced ? fenced[1] : text;
    const start = body.indexOf('[');
    const end = body.lastIndexOf(']');
    if (start < 0 || end <= start)
        throw new Error('模型没有输出 JSON');
    let raw;
    try {
        raw = JSON.parse(body.slice(start, end + 1));
    }
    catch {
        throw new Error('模型输出的 JSON 解析不了');
    }
    if (!Array.isArray(raw))
        throw new Error('模型输出的不是数组');
    const out = [];
    for (const item of raw) {
        const id = Number(item?.id);
        if (!ids.includes(id) || out.some(o => o.id === id))
            continue;
        const entities = [];
        const addEntity = (name, kind) => {
            if (name === '' || normalize(name) === '')
                return;
            if (!entities.some(e => normalize(e.name) === normalize(name)))
                entities.push({ name, kind: kind.slice(0, 10) });
        };
        for (const e of Array.isArray(item.entities) ? item.entities : [])
            addEntity(cleanName(e?.name), String(e?.kind ?? '').trim());
        const relations = [];
        for (const r of Array.isArray(item.relations) ? item.relations : []) {
            const src = cleanName(r?.src), dst = cleanName(r?.dst), rel = String(r?.rel ?? '').trim().slice(0, MAX_REL);
            if (src === '' || dst === '' || rel === '' || normalize(src) === normalize(dst))
                continue;
            addEntity(src, '');
            addEntity(dst, '');
            relations.push({ src, rel, dst });
        }
        out.push({ id, entities, relations });
    }
    return out;
}
/** 关系网的表（数据库版本 5 建的）。 */
export class GraphStore {
    db;
    constructor(db) {
        this.db = db;
    }
    /** 还没抽过、或者内容改过（指纹变了）的正常记忆。日记太长不抽。 */
    pending(limit, skip = new Set()) {
        const rows = this.db.prepare(`SELECT m.id, m.scope, m.content, m.hash FROM memories m LEFT JOIN graph_done g ON g.memory_id = m.id
      WHERE m.status = 'active' AND m.superseded_by IS NULL AND m.kind != 'diary' AND (g.memory_id IS NULL OR g.hash != m.hash)
      ORDER BY m.id LIMIT ?`).all(limit + skip.size);
        return rows.filter(r => !skip.has(Number(r.id))).slice(0, limit).map(r => ({ ...r, id: Number(r.id) }));
    }
    counts() {
        const one = (sql) => Number(this.db.prepare(sql).get().n);
        return {
            memories: one("SELECT COUNT(*) AS n FROM memories WHERE status = 'active' AND superseded_by IS NULL AND kind != 'diary'"),
            done: one("SELECT COUNT(*) AS n FROM memories m JOIN graph_done g ON g.memory_id = m.id AND g.hash = m.hash WHERE m.status = 'active' AND m.superseded_by IS NULL AND m.kind != 'diary'"),
            entities: one('SELECT COUNT(*) AS n FROM graph_entities'),
            relations: one('SELECT COUNT(*) AS n FROM graph_edges'),
        };
    }
    entityId(scope, name, kind) {
        const norm = normalize(name);
        const row = this.db.prepare('SELECT id, kind FROM graph_entities WHERE scope = ? AND norm = ?').get(scope, norm);
        if (row !== undefined) {
            if (row.kind === '' && kind !== '')
                this.db.prepare('UPDATE graph_entities SET kind = ? WHERE id = ?').run(kind, row.id);
            return Number(row.id);
        }
        return Number(this.db.prepare('INSERT INTO graph_entities (scope, name, norm, kind) VALUES (?, ?, ?, ?)').run(scope, name, norm, kind).lastInsertRowid);
    }
    /** 存一条记忆抽出来的东西（先清掉这条记忆以前的）。 */
    save(memory, x) {
        this.forgetMemory(memory.id);
        const ids = new Map();
        for (const e of x.entities) {
            const id = this.entityId(memory.scope, e.name, e.kind);
            ids.set(normalize(e.name), id);
            this.db.prepare('INSERT OR IGNORE INTO graph_mentions (entity_id, memory_id) VALUES (?, ?)').run(id, memory.id);
        }
        for (const r of x.relations) {
            const src = ids.get(normalize(r.src)), dst = ids.get(normalize(r.dst));
            if (src === undefined || dst === undefined)
                continue;
            this.db.prepare('INSERT INTO graph_edges (scope, src, rel, dst, memory_id) VALUES (?, ?, ?, ?, ?)').run(memory.scope, src, r.rel, dst, memory.id);
        }
        this.db.prepare('INSERT INTO graph_done (memory_id, hash, at) VALUES (?, ?, ?) ON CONFLICT(memory_id) DO UPDATE SET hash = excluded.hash, at = excluded.at').run(memory.id, memory.hash, Date.now());
    }
    /** 去掉一条记忆在关系网里的痕迹（实体留着，没人提到的由 tidy 清掉）。 */
    forgetMemory(memoryId) {
        this.db.prepare('DELETE FROM graph_mentions WHERE memory_id = ?').run(memoryId);
        this.db.prepare('DELETE FROM graph_edges WHERE memory_id = ?').run(memoryId);
        this.db.prepare('DELETE FROM graph_done WHERE memory_id = ?').run(memoryId);
    }
    /** 清掉已经删除的记忆留下的、以及没有任何记忆提到的实体。 */
    tidy() {
        this.db.exec(`DELETE FROM graph_mentions WHERE memory_id NOT IN (SELECT id FROM memories);
      DELETE FROM graph_edges WHERE memory_id NOT IN (SELECT id FROM memories);
      DELETE FROM graph_done WHERE memory_id NOT IN (SELECT id FROM memories);
      DELETE FROM graph_entities WHERE id NOT IN (SELECT entity_id FROM graph_mentions) AND id NOT IN (SELECT src FROM graph_edges) AND id NOT IN (SELECT dst FROM graph_edges);`);
    }
    /** 全部清空（手动重建）。 */
    clear() {
        this.db.exec('DELETE FROM graph_mentions; DELETE FROM graph_edges; DELETE FROM graph_done; DELETE FROM graph_entities;');
    }
    /** 名字还没有当前向量模型向量的实体。 */
    missingEmbeddings(model, limit) {
        return this.db.prepare('SELECT id, name FROM graph_entities WHERE embed_model IS NULL OR embed_model != ? LIMIT ?').all(model, limit)
            .map(r => ({ id: Number(r.id), name: r.name }));
    }
    setEmbedding(id, v, model) {
        this.db.prepare('UPDATE graph_entities SET embedding = ?, embed_model = ? WHERE id = ?').run(toBlob(v), model, id);
    }
    /** 这些归属里的实体（召回用）。 */
    entities(scopes, allGroups) {
        const marks = scopes.map(() => '?').join(', ');
        const where = (scopes.length > 0 ? 'scope IN (' + marks + ')' : '0') + (allGroups ? " OR scope LIKE 'group:%'" : '');
        return this.db.prepare('SELECT id, scope, name, norm, embedding, embed_model FROM graph_entities WHERE ' + where).all(...scopes)
            .map(r => ({ id: Number(r.id), scope: r.scope, name: r.name, norm: r.norm, ...(r.embedding ? { embedding: r.embedding, model: String(r.embed_model) } : {}) }));
    }
    mentions(entityId) {
        return this.db.prepare('SELECT memory_id FROM graph_mentions WHERE entity_id = ?').all(entityId).map(r => Number(r.memory_id));
    }
    /** 和这个实体有关系的实体，带关系所在的记忆。 */
    neighbors(entityId) {
        return this.db.prepare('SELECT dst AS e, memory_id AS m FROM graph_edges WHERE src = ? UNION ALL SELECT src AS e, memory_id AS m FROM graph_edges WHERE dst = ?').all(entityId, entityId)
            .map(r => ({ entity: Number(r.e), memory: Number(r.m) }));
    }
    /** 设置页看看关系网长什么样：最近的几条关系。 */
    sample(limit) {
        return this.db.prepare(`SELECT e.scope AS scope, a.name AS src, e.rel AS rel, b.name AS dst, e.memory_id AS memory FROM graph_edges e
      JOIN graph_entities a ON a.id = e.src JOIN graph_entities b ON b.id = e.dst ORDER BY e.id DESC LIMIT ?`).all(limit)
            .map(r => ({ scope: r.scope, src: r.src, rel: r.rel, dst: r.dst, memory: Number(r.memory) }));
    }
}
/**
 * 图那一路：这条消息提到了哪些实体，顺着关系走几步，给每条记忆一个分数（记忆 id → 分数）。
 * 只看这个会话看得到的归属。中心实体（被很多记忆提到的，比如「主人」）带来的分数按提到次数摊薄，也不从它往外走。
 */
export function graphScores(graph, scope, query, hops, vector) {
    const out = new Map();
    const q = normalize(query);
    if (q === '')
        return out;
    const { scopes, allGroups } = visibleScopes(scope);
    const seeds = [];
    for (const e of graph.entities(scopes, allGroups)) {
        let score = 0;
        if (e.norm.length >= 2 && q.includes(e.norm))
            score = 1;
        else if (vector !== undefined && e.embedding !== undefined && e.model === vector.model) {
            const c = cosine(vector.query, fromBlob(e.embedding));
            if (c >= ENTITY_VECTOR_THRESHOLD)
                score = c;
        }
        if (score > 0)
            seeds.push({ id: e.id, score });
    }
    seeds.sort((a, b) => b.score - a.score);
    const add = (memory, score) => { out.set(memory, (out.get(memory) ?? 0) + score); };
    const seen = new Set();
    let frontier = seeds.slice(0, MAX_SEEDS);
    for (let step = 0; step <= Math.max(0, Math.min(2, hops)) && frontier.length > 0; step++) {
        const next = [];
        for (const { id, score } of frontier) {
            if (seen.has(id))
                continue;
            seen.add(id);
            const ms = graph.mentions(id);
            const hub = ms.length > HUB_DEGREE;
            const weight = score / Math.sqrt(Math.max(1, ms.length));
            for (const m of ms)
                add(m, weight);
            if (hub)
                continue;
            for (const n of graph.neighbors(id)) {
                add(n.memory, score * 0.5);
                if (!seen.has(n.entity))
                    next.push({ id: n.entity, score: score * 0.5 });
            }
        }
        frontier = next;
    }
    return out;
}
const MAX_ERRORS = 20;
const MAX_FAILS_IN_ROW = 3;
/** 后台补抽关系网：打开开关后对已有记忆补抽一遍，之后每有新记忆就抽新的。可暂停、继续、取消、手动重建。 */
export class GraphBuilder {
    graph;
    deps;
    job;
    stop;
    skip = new Set();
    st = { state: 'idle', errors: [] };
    constructor(graph, deps) {
        this.graph = graph;
        this.deps = deps;
    }
    state() {
        return { ...this.st, state: this.deps.settings().enabled ? this.st.state : 'disabled', counts: this.graph.counts() };
    }
    ensure() {
        if (!this.deps.settings().enabled || this.job !== undefined)
            return;
        if (this.st.state === 'paused' || this.st.state === 'cancelled' || this.st.state === 'failed')
            return;
        this.graph.tidy();
        if (this.graph.pending(1, this.skip).length === 0 && !this.needsEntityVectors())
            return;
        this.start(false);
    }
    needsEntityVectors() {
        const es = this.deps.embedSettings();
        return embedEnabled(es) && this.graph.missingEmbeddings(es.model.trim(), 1).length > 0;
    }
    start(full) {
        if (!this.deps.settings().enabled)
            return;
        if (this.job !== undefined) {
            if (this.stop === 'pause')
                this.stop = undefined;
            return;
        }
        if (full) {
            this.graph.clear();
            this.skip.clear();
        }
        const c = this.graph.counts();
        this.st = { state: 'running', todo: c.memories - c.done, done: 0, errors: full ? [] : this.st.errors, startedAt: Date.now() };
        this.stop = undefined;
        this.job = this.run().finally(() => { this.job = undefined; });
    }
    pause() {
        if (this.job !== undefined)
            this.stop = 'pause';
    }
    cancel() {
        if (this.job !== undefined)
            this.stop = 'cancel';
        else if (this.st.state === 'paused')
            this.st = { ...this.st, state: 'cancelled', finishedAt: Date.now() };
    }
    async idle() {
        await this.job;
    }
    async run() {
        let fails = 0;
        for (;;) {
            if (this.stop !== undefined) {
                this.st = { ...this.st, state: this.stop === 'pause' ? 'paused' : 'cancelled', finishedAt: Date.now() };
                this.deps.log('info', '关系网' + (this.stop === 'pause' ? '暂停' : '取消'));
                return;
            }
            const s = this.deps.settings();
            if (!s.enabled) {
                this.st = { ...this.st, state: 'idle', finishedAt: Date.now() };
                return;
            }
            const batch = this.graph.pending(Math.max(1, Math.min(30, s.batch)), this.skip);
            try {
                if (batch.length === 0) {
                    await this.embedEntities();
                    this.st = { ...this.st, state: 'done', finishedAt: Date.now() };
                    this.deps.log('info', '关系网已补抽完');
                    return;
                }
                const llm = this.deps.llm(), target = this.deps.target();
                if (llm === undefined || target === undefined)
                    throw new Error('没有可用的模型');
                const text = await complete(llm, target, graphPrompt(batch), 4096);
                const got = parseGraph(text, batch.map(b => b.id));
                for (const b of batch)
                    this.graph.save(b, got.find(g => g.id === b.id) ?? { id: b.id, entities: [], relations: [] });
                await this.embedEntities();
                this.st = { ...this.st, done: (this.st.done ?? 0) + batch.length };
                fails = 0;
            }
            catch (e) {
                const error = e instanceof Error ? e.message : String(e);
                fails += 1;
                this.st = { ...this.st, lastError: error };
                if (batch.length === 1) {
                    this.skip.add(batch[0].id);
                    this.st.errors = [...this.st.errors, { id: batch[0].id, error }].slice(-MAX_ERRORS);
                }
                if (fails >= MAX_FAILS_IN_ROW) {
                    this.st = { ...this.st, state: 'failed', finishedAt: Date.now() };
                    this.deps.log('warn', '关系网补抽失败：' + error);
                    return;
                }
                await new Promise(r => setTimeout(r, 1000 * fails));
            }
        }
    }
    /** 填了向量 Key 时给实体名算向量（召回时能认出说法不同的同一个东西）。失败不影响关系网。 */
    async embedEntities() {
        const es = this.deps.embedSettings();
        if (!embedEnabled(es))
            return;
        const model = es.model.trim();
        for (let round = 0; round < 50; round++) {
            const missing = this.graph.missingEmbeddings(model, Math.max(1, Math.min(64, es.batch)));
            if (missing.length === 0)
                return;
            try {
                const vs = await embed(missing.map(m => m.name), es, this.deps.doFetch);
                missing.forEach((m, i) => this.graph.setEmbedding(m.id, vs[i], model));
            }
            catch (e) {
                this.deps.log('warn', '实体名算向量失败（不影响关系网）：' + (e instanceof Error ? e.message : String(e)));
                return;
            }
        }
    }
}
/** 把两路排名融合（RRF）：每条记忆的分 = Σ 1/(60 + 名次)。 */
export function fuse(docRanked, graphRanked) {
    const out = new Map();
    docRanked.forEach((id, i) => out.set(id, (out.get(id) ?? 0) + 1 / (60 + i + 1)));
    graphRanked.forEach((id, i) => out.set(id, (out.get(id) ?? 0) + 1 / (60 + i + 1)));
    return out;
}
