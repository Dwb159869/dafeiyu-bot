// 长期记忆：一条一条的事实、喜好、事件、约定，存在 companion.db 的 memories 表里。
// 归属（scope）：master（主人）、public（公开）、group:<群号>、user:<QQ 号>（某人私聊）。
// 写入时去重（几乎一样的合并、加重要程度），彻底遗忘只留指纹（tombstones），同样的内容以后不会再被写回来。
import { buildIndex, fingerprint, overlap, toBlob } from './text.js';
export const KINDS = ['fact', 'preference', 'event', 'promise', 'other'];
/** 相似到这个程度就当成同一条，合并而不是新存。 */
const MERGE_OVERLAP = 0.85;
/** 「取代」要找的旧记忆至少相似到这个程度。 */
const REPLACE_OVERLAP = 0.4;
const MAX_CONTENT = 8000;
/** 一个会话自己的记忆归属。 */
export function ownScope(scope) {
    if (scope.category === 'master')
        return 'master';
    if (scope.category === 'group')
        return 'group:' + (scope.groupId ?? 'unknown');
    return 'user:' + (scope.userId ?? 'unknown');
}
/** 这个会话能想起哪些归属的记忆；主人还能想起所有群的（排名时打折）。 */
export function visibleScopes(scope) {
    if (scope.category === 'master')
        return { scopes: ['master', 'public'], allGroups: true };
    return { scopes: [ownScope(scope), 'public'], allGroups: false };
}
/** 写入时的默认可信度。 */
export function defaultTrust(category, writer) {
    if (writer === 'settings' || writer === 'import')
        return 1;
    return category === 'master' ? 0.9 : 0.4;
}
function fromRow(r) {
    return {
        id: Number(r.id), scope: r.scope, kind: r.kind, content: r.content,
        importance: Number(r.importance), trust: Number(r.trust), writer: r.writer,
        ...(r.source_umo !== null ? { sourceUmo: r.source_umo } : {}),
        ...(r.source_session !== null ? { sourceSession: r.source_session } : {}),
        ...(r.source_from !== null ? { sourceFrom: Number(r.source_from) } : {}),
        ...(r.source_to !== null ? { sourceTo: Number(r.source_to) } : {}),
        createdAt: Number(r.created_at), tz: r.tz,
        ...(r.last_recalled !== null ? { lastRecalled: Number(r.last_recalled) } : {}),
        recallCount: Number(r.recall_count), status: r.status,
        ...(r.forgotten_at !== null ? { forgottenAt: Number(r.forgotten_at) } : {}),
        ...(r.superseded_by !== null ? { supersededBy: Number(r.superseded_by) } : {}),
        ...(r.embed_model !== null ? { embedModel: r.embed_model } : {}),
    };
}
const COLS = 'id, scope, kind, content, importance, trust, writer, source_umo, source_session, source_from, source_to, created_at, tz, last_recalled, recall_count, status, forgotten_at, superseded_by, embed_model';
const clamp = (n, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : lo));
export class MemoryStore {
    db;
    tz;
    index;
    /** 每次写入加一，关键词索引和召回缓存据此失效 */
    version = 0;
    constructor(db, tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone) {
        this.db = db;
        this.tz = tz;
    }
    changed() {
        this.version += 1;
    }
    get(id) {
        const r = this.db.prepare('SELECT ' + COLS + ' FROM memories WHERE id = ?').get(id);
        return r === undefined ? undefined : fromRow(r);
    }
    /** 正常状态（没遗忘、没被取代）的记忆，按归属。 */
    active(scopes, allGroups = false) {
        const marks = scopes.map(() => '?').join(', ');
        const where = (scopes.length > 0 ? 'scope IN (' + marks + ')' : '0') + (allGroups ? " OR scope LIKE 'group:%'" : '');
        const rows = this.db.prepare('SELECT ' + COLS + " FROM memories WHERE status = 'active' AND superseded_by IS NULL AND (" + where + ')').all(...scopes);
        return rows.map(fromRow);
    }
    /** 所有正常状态记忆的关键词索引（写入后自动重建）。 */
    keywordIndex() {
        if (this.index === undefined || this.index.version !== this.version) {
            const rows = this.db.prepare("SELECT id, content FROM memories WHERE status = 'active' AND superseded_by IS NULL").all();
            this.index = { version: this.version, value: buildIndex(rows.map(r => ({ id: Number(r.id), content: r.content }))) };
        }
        return this.index.value;
    }
    /** 写一条：空的不写、彻底遗忘过的不写回来、几乎一样的合并。 */
    add(m) {
        const content = m.content.trim().slice(0, MAX_CONTENT);
        if (content === '')
            return { action: 'empty' };
        const hash = fingerprint(content);
        if (this.db.prepare('SELECT 1 FROM tombstones WHERE hash = ? AND scope = ?').get(hash, m.scope) !== undefined)
            return { action: 'blocked' };
        const importance = clamp(m.importance ?? 0.5);
        const existing = this.active([m.scope]);
        const keep = existing.find(x => x.content === content || overlap(x.content, content) >= MERGE_OVERLAP);
        if (keep !== undefined) {
            this.db.prepare('UPDATE memories SET importance = ?, trust = MAX(trust, ?) WHERE id = ?').run(clamp(Math.max(keep.importance, importance) + 0.05), clamp(m.trust ?? 0.5), keep.id);
            this.changed();
            return { action: 'merged', id: keep.id };
        }
        const r = this.db.prepare(`INSERT INTO memories (scope, kind, content, importance, trust, writer, source_umo, source_session, source_from, source_to, created_at, tz, hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(m.scope, m.kind && (KINDS.includes(m.kind) || m.kind === 'diary') ? m.kind : 'other', content, importance, clamp(m.trust ?? 0.5), m.writer, m.sourceUmo ?? null, m.sourceSession ?? null, m.sourceFrom ?? null, m.sourceTo ?? null, Date.now(), this.tz(), hash);
        const id = Number(r.lastInsertRowid);
        let superseded;
        if (m.replaces && m.replaces.trim() !== '') {
            let best;
            for (const old of existing) {
                const score = Math.max(overlap(old.content, m.replaces), old.content.includes(m.replaces.trim()) ? 1 : 0);
                if (score >= REPLACE_OVERLAP && (best === undefined || score > best.score))
                    best = { id: old.id, score };
            }
            if (best !== undefined) {
                this.db.prepare('UPDATE memories SET superseded_by = ? WHERE id = ?').run(id, best.id);
                superseded = best.id;
            }
        }
        this.changed();
        return { action: 'added', id, ...(superseded !== undefined ? { superseded } : {}) };
    }
    /** 某个归属在一段时间里新写的记忆（写日记用）。 */
    createdBetween(scope, from, to) {
        return this.db.prepare('SELECT ' + COLS + " FROM memories WHERE scope = ? AND created_at > ? AND created_at <= ? AND kind != 'diary' AND status = 'active' ORDER BY created_at").all(scope, from, to).map(fromRow);
    }
    /** 改内容（设置页）。 */
    edit(id, content) {
        const text = content.trim().slice(0, MAX_CONTENT);
        if (text === '')
            return false;
        const r = this.db.prepare('UPDATE memories SET content = ?, hash = ?, embedding = NULL, embed_model = NULL WHERE id = ?').run(text, fingerprint(text), id);
        this.changed();
        return Number(r.changes) > 0;
    }
    /** 普通遗忘：不再被想起，原文保留，可以恢复。 */
    forget(id) {
        const r = this.db.prepare("UPDATE memories SET status = 'forgotten', forgotten_at = ? WHERE id = ? AND status = 'active'").run(Date.now(), id);
        this.changed();
        return Number(r.changes) > 0;
    }
    /** 恢复：普通遗忘的回到正常；被取代的取消取代。 */
    restore(id) {
        const r = this.db.prepare("UPDATE memories SET status = 'active', forgotten_at = NULL, superseded_by = NULL WHERE id = ?").run(id);
        this.changed();
        return Number(r.changes) > 0;
    }
    /** 彻底遗忘：删掉原文，只留指纹。 */
    purge(id) {
        const m = this.db.prepare('SELECT scope, hash FROM memories WHERE id = ?').get(id);
        if (m === undefined)
            return false;
        this.db.prepare('INSERT OR IGNORE INTO tombstones (hash, scope, purged_at) VALUES (?, ?, ?)').run(m.hash, m.scope, Date.now());
        this.db.prepare('DELETE FROM memories WHERE id = ?').run(id);
        this.db.prepare('UPDATE memories SET superseded_by = NULL WHERE superseded_by = ?').run(id);
        this.changed();
        return true;
    }
    /** 想起来了：记次数、时间，重要程度稍微回升。 */
    markRecalled(ids) {
        const now = Date.now();
        const stmt = this.db.prepare('UPDATE memories SET last_recalled = ?, recall_count = recall_count + 1, importance = MIN(1, importance + 0.02) WHERE id = ?');
        for (const id of ids)
            stmt.run(now, id);
        // 只改了次数和时间，不影响关键词索引，不算"写入"
    }
    list(q) {
        const where = [];
        const args = [];
        if (q.scope) {
            if (q.scope === 'group:*')
                where.push("scope LIKE 'group:%'");
            else if (q.scope === 'user:*')
                where.push("scope LIKE 'user:%'");
            else {
                where.push('scope = ?');
                args.push(q.scope);
            }
        }
        const status = q.status ?? 'active';
        if (status === 'active')
            where.push("status = 'active' AND superseded_by IS NULL");
        else if (status === 'forgotten')
            where.push("status = 'forgotten'");
        else if (status === 'superseded')
            where.push('superseded_by IS NOT NULL');
        if (q.q && q.q.trim() !== '') {
            where.push('content LIKE ?');
            args.push('%' + q.q.trim() + '%');
        }
        const clause = where.length > 0 ? ' WHERE ' + where.join(' AND ') : '';
        const total = Number(this.db.prepare('SELECT COUNT(*) AS n FROM memories' + clause).get(...args).n);
        const rows = this.db.prepare('SELECT ' + COLS + ' FROM memories' + clause + ' ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?')
            .all(...args, Math.min(200, q.limit ?? 50), q.offset ?? 0);
        return { total, items: rows.map(fromRow) };
    }
    stats() {
        const counts = this.db.prepare(`SELECT
      COUNT(CASE WHEN status = 'active' AND superseded_by IS NULL THEN 1 END) AS active,
      COUNT(CASE WHEN status = 'forgotten' THEN 1 END) AS forgotten,
      COUNT(CASE WHEN superseded_by IS NOT NULL THEN 1 END) AS superseded
      FROM memories`).get();
        const byScope = {};
        for (const r of this.db.prepare("SELECT CASE WHEN scope LIKE 'group:%' THEN 'group' WHEN scope LIKE 'user:%' THEN 'user' ELSE scope END AS s, COUNT(*) AS n FROM memories WHERE status = 'active' AND superseded_by IS NULL GROUP BY s").all())
            byScope[r.s] = Number(r.n);
        return {
            active: Number(counts.active), forgotten: Number(counts.forgotten), superseded: Number(counts.superseded),
            tombstones: Number(this.db.prepare('SELECT COUNT(*) AS n FROM tombstones').get().n),
            byScope,
        };
    }
    //#region 向量
    /** 还没有当前模型向量的记忆（含已遗忘的，恢复后不用重算），跳过 skip 里的。 */
    missingEmbeddings(model, limit, skip = new Set()) {
        const rows = this.db.prepare('SELECT id, content FROM memories WHERE embed_model IS NULL OR embed_model != ? ORDER BY id LIMIT ?').all(model, limit + skip.size);
        return rows.map(r => ({ id: Number(r.id), content: r.content })).filter(r => !skip.has(r.id)).slice(0, limit);
    }
    countEmbedded(model) {
        const row = this.db.prepare('SELECT COUNT(*) AS total, COUNT(CASE WHEN embed_model = ? THEN 1 END) AS embedded FROM memories').get(model);
        return { total: Number(row.total), embedded: Number(row.embedded) };
    }
    setEmbedding(id, vector, model) {
        this.db.prepare('UPDATE memories SET embedding = ?, embed_model = ? WHERE id = ?').run(toBlob(vector), model, id);
    }
    /** 当前模型的向量（只要正常状态的）。 */
    embeddings(model, ids) {
        const out = new Map();
        if (ids.length === 0)
            return out;
        const stmt = this.db.prepare('SELECT embedding FROM memories WHERE id = ? AND embed_model = ?');
        for (const id of ids) {
            const r = stmt.get(id, model);
            if (r?.embedding)
                out.set(id, r.embedding);
        }
        return out;
    }
    clearEmbeddings() {
        this.db.exec('UPDATE memories SET embedding = NULL, embed_model = NULL');
    }
}
