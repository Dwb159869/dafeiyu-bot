import { createHash } from 'node:crypto';
export const REALITIES = ['user_statement', 'verified_fact', 'inference', 'imported_summary', 'self_note'];
export const SLOTS = ['profile', 'current_window', 'summary', 'stable', 'self_timeline'];
const DAY = 86400000;
export const normalized = s => String(s).normalize('NFKC').toLowerCase().replace(/\s+/gu, ' ').trim();
export const digest = s => createHash('sha256').update(String(s)).digest('hex');
function own(s) { return s.category === 'master' ? 'master' : s.category === 'group' ? 'group:' + (s.groupId ?? 'unknown') : 'user:' + (s.userId ?? 'unknown'); }
export function visible(m, s) { return m.scope === 'public' || m.scope === own(s) || (s.category === 'master' && m.scope.startsWith('group:')); }
export function defaults(m) {
    const imported = m.writer.startsWith('import:');
    const self = ['diary', 'self_note'].includes(m.kind) || m.writer === 'diary';
    return {
        reality: imported ? 'imported_summary' : self ? 'self_note' : 'inference',
        confidence: Math.min(imported ? 0.5 : self ? 0.6 : 0.55, m.trust),
        clarity: null, slot: imported ? 'summary' : self ? 'self_timeline' : m.kind === 'preference' ? 'profile' : m.kind === 'fact' ? 'stable' : 'current_window',
    };
}
export class RememberEngine {
    constructor(store, { budgetChars = 800 } = {}) {
        this.store = store; this.db = store.db; this.budget = Math.max(300, Math.min(1600, budgetChars));
        this.db.exec('PRAGMA busy_timeout=3000;');
        this.db.exec('CREATE TABLE IF NOT EXISTS ry_meta (memory_id INTEGER PRIMARY KEY, content_hash TEXT NOT NULL, reality TEXT NOT NULL, confidence REAL NOT NULL, clarity REAL, slot TEXT NOT NULL, merged_count INTEGER NOT NULL DEFAULT 1, updated_at INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS ry_evidence (id INTEGER PRIMARY KEY, memory_id INTEGER NOT NULL, source_key TEXT UNIQUE NOT NULL, source_session TEXT, source_umo TEXT, message_id TEXT, origin TEXT NOT NULL, created_at INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS ry_traces (id INTEGER PRIMARY KEY, at INTEGER NOT NULL, scope TEXT NOT NULL, query_hash TEXT NOT NULL, data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS ry_changes (id INTEGER PRIMARY KEY, at INTEGER NOT NULL, memory_id INTEGER NOT NULL, action TEXT NOT NULL, before_json TEXT, after_json TEXT NOT NULL);');
        this.sync();
    }
    sync() {
        const rows = this.db.prepare('SELECT id FROM memories').all();
        for (const row of rows) this.meta(this.store.get(Number(row.id)));
        return rows.length;
    }
    meta(m) {
        if (!m) return undefined;
        const hash = digest(m.content);
        let r = this.db.prepare('SELECT * FROM ry_meta WHERE memory_id=?').get(m.id);
        if (!r || r.content_hash !== hash) {
            const d = defaults(m);
            // A changed source invalidates old annotations; an edit cannot inherit certainty silently.
            if (!r && this.db.prepare("SELECT 1 FROM sqlite_master WHERE name='dafeiyu_memory_origin'").get()) {
                const old = this.db.prepare('SELECT clarity FROM dafeiyu_memory_origin WHERE memory_id=?').get(m.id);
                if (old?.clarity != null) d.clarity = old.clarity;
            }
            this.db.prepare('INSERT INTO ry_meta (memory_id,content_hash,reality,confidence,clarity,slot,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(memory_id) DO UPDATE SET content_hash=excluded.content_hash,reality=excluded.reality,confidence=excluded.confidence,clarity=excluded.clarity,slot=excluded.slot,updated_at=excluded.updated_at').run(m.id, hash, d.reality, d.confidence, d.clarity, d.slot, Date.now());
            r = this.db.prepare('SELECT * FROM ry_meta WHERE memory_id=?').get(m.id);
        }
        return { ...r, confidence: Number(r.confidence), clarity: r.clarity == null ? null : Number(r.clarity) };
    }
    evidence(id, source) {
        const key = digest(JSON.stringify([id, source.session ?? '', source.umo ?? '', source.messageId ?? '', source.origin]));
        this.db.prepare('INSERT OR IGNORE INTO ry_evidence (memory_id,source_key,source_session,source_umo,message_id,origin,created_at) VALUES (?,?,?,?,?,?,?)').run(id, key, source.session ?? null, source.umo ?? null, source.messageId ?? null, source.origin, Date.now());
    }
    annotate(id, patch, actor = 'owner') {
        const m = this.store.get(id);
        if (!m) throw new Error('记忆不存在');
        const before = this.meta(m), next = { ...before };
        for (const key of ['reality', 'slot', 'confidence', 'clarity']) if (Object.hasOwn(patch, key)) next[key] = patch[key];
        if (!REALITIES.includes(next.reality) || !SLOTS.includes(next.slot)) throw new Error('记忆类型或槽位无效');
        for (const key of ['confidence', 'clarity']) if (next[key] != null && (typeof next[key] !== 'number' || !Number.isFinite(next[key]) || next[key] < 0 || next[key] > 1)) throw new Error(key + ' 必须为 0–1');
        if (next.confidence == null) throw new Error('confidence 不能为空');
        if (next.reality === 'imported_summary') next.confidence = Math.min(0.5, next.confidence);
        if (Object.hasOwn(patch, 'importance')) {
            if (typeof patch.importance !== 'number' || !Number.isFinite(patch.importance) || patch.importance < 0 || patch.importance > 1) throw new Error('importance 必须为 0–1');
        }
        this.db.prepare('UPDATE ry_meta SET reality=?,confidence=?,clarity=?,slot=?,updated_at=? WHERE memory_id=?').run(next.reality, next.confidence, next.clarity, next.slot, Date.now(), id);
        if (Object.hasOwn(patch, 'importance')) {
            this.db.prepare('UPDATE memories SET importance=? WHERE id=?').run(patch.importance, id);
        }
        this.db.prepare('INSERT INTO ry_changes (at,memory_id,action,before_json,after_json) VALUES (?,?,?,?,?)').run(Date.now(), id, actor, JSON.stringify({ ...before, importance: m.importance }), JSON.stringify({ ...this.meta(m), importance: patch.importance ?? m.importance }));
        this.store.changed();
        return this.meta(m);
    }
    wrapWrites() {
        const original = this.store.add, previousMatcher = this.store.matchMemory;
        this.store.matchMemory = (existing, input, content) => normalized(existing.content) === normalized(content);
        this.store.add = input => {
            // A model recollection is not new evidence that can retire an established statement.
            const effective = input.replaces && !String(input.writer).startsWith('user:') ? { ...input, replaces: undefined } : input;
            const result = original.call(this.store, effective);
            if (result.id) {
                this.meta(this.store.get(result.id));
                if (result.action === 'merged') this.db.prepare('UPDATE ry_meta SET merged_count=merged_count+1 WHERE memory_id=?').run(result.id);
                this.evidence(result.id, { session: input.sourceSession, umo: input.sourceUmo, origin: input.writer || 'unknown', messageId: input.ryMessageId });
            }
            return result;
        };
        const wrapped = this.store.add;
        return () => { if (this.store.add === wrapped) this.store.add = original; this.store.matchMemory = previousMatcher; };
    }
    select({ scope, query, ranked, topK, sessionId, now = Date.now() }) {
        const blocked = [], candidates = [];
        for (const item of ranked) {
            const m = item.memory, meta = this.meta(m);
            if (!visible(m, scope)) { blocked.push({ id: m.id, reason: 'scope' }); continue; }
            if (m.status !== 'active' || m.supersededBy) { blocked.push({ id: m.id, reason: 'inactive' }); continue; }
            if (meta.confidence < 0.25) { blocked.push({ id: m.id, reason: 'low-confidence' }); continue; }
            const slot = m.sourceSession && m.sourceSession === sessionId && !['profile', 'summary', 'self_timeline'].includes(meta.slot) ? 'current_window' : meta.slot;
            const decay = Math.pow(0.5, Math.max(0, now - (m.lastRecalled ?? m.createdAt)) / (90 * DAY));
            const importance = Math.min(1, m.importance * decay);
            const score = item.relevance * (0.65 + 0.35 * meta.confidence) + 0.12 * importance + (meta.clarity == null ? 0 : 0.03 * meta.clarity);
            candidates.push({ ...item, score, memory: { ...m, ry: { ...meta, slot } } });
        }
        candidates.sort((a, b) => b.score - a.score || a.memory.id - b.memory.id);
        const picked = [], seen = new Set(), quota = { profile: 1, current_window: 1, summary: 1, stable: 1, self_timeline: 1 };
        function take(item) {
            const key = item.memory.scope + ':' + normalized(item.memory.content);
            if (seen.has(key)) { blocked.push({ id: item.memory.id, reason: 'duplicate' }); return false; }
            seen.add(key); picked.push(item); return true;
        }
        for (const slot of SLOTS) for (const item of candidates) {
            if (picked.length >= topK || !quota[slot]) break;
            if (item.memory.ry.slot === slot && take(item)) quota[slot]--;
        }
        for (const item of candidates) if (picked.length < topK && !picked.some(x => x.memory.id === item.memory.id) && !(item.memory.ry.slot === 'summary' && picked.some(x => x.memory.ry.slot === 'summary'))) take(item);
        const formatted = this.format(picked);
        const used = picked.filter(x => formatted.ids.includes(x.memory.id));
        const usedIds = new Set(used.map(x => x.memory.id));
        for (const item of candidates) if (!usedIds.has(item.memory.id) && !blocked.some(x => x.id === item.memory.id)) blocked.push({ id: item.memory.id, reason: 'slot-or-budget' });
        const trace = {
            selected: used.map(x => ({ id: x.memory.id, slot: x.memory.ry.slot, reality: x.memory.ry.reality, confidence: x.memory.ry.confidence, clarity: x.memory.ry.clarity, relevance: x.relevance, score: x.score, reason: '相关度+确定性+重要度衰减；分槽及预算内' })),
            blocked, chars: formatted.text.length, budgetChars: this.budget,
        };
        this.db.prepare('INSERT INTO ry_traces (at,scope,query_hash,data) VALUES (?,?,?,?)').run(now, own(scope), digest(query), JSON.stringify(trace));
        this.db.prepare('DELETE FROM ry_traces WHERE id NOT IN (SELECT id FROM ry_traces ORDER BY id DESC LIMIT 500)').run();
        return used;
    }
    format(items) {
        const head = '<memory>\n仅供相关话题参考；用户陈述不等于外部核实，推测不当事实，旧摘要不决定当前称呼、能力或权限。\n';
        const tail = '\n</memory>';
        let text = head; const ids = [];
        const labels = { user_statement: '用户陈述', verified_fact: '已核实', inference: '推测', imported_summary: '旧摘要', self_note: '自身记录' };
        for (const { memory: m } of items) {
            const tag = labels[m.ry?.reality] ?? '来源未标注';
            const date = new Date(m.createdAt).toISOString().slice(0, 10);
            const lead = '- [' + tag + ' #' + m.id + ' ' + date + '] ';
            const available = this.budget - text.length - tail.length - lead.length - 2;
            if (available < 18) break;
            const body = m.content.replace(/\s+/g, ' ').trim();
            const cap = Math.min(220, available);
            let clipped = body.slice(0, cap);
            if (/[\uD800-\uDBFF]$/.test(clipped)) clipped = clipped.slice(0, -1);
            text += lead + clipped + (body.length > cap ? '…' : '') + '\n';
            ids.push(m.id);
        }
        return { text: ids.length ? text.trimEnd() + tail : '', ids };
    }
    traces(scope, limit = 10) { return this.db.prepare('SELECT * FROM ry_traces WHERE scope=? ORDER BY id DESC LIMIT ?').all(own(scope), limit).map(r => ({ id: r.id, at: r.at, queryHash: r.query_hash, ...JSON.parse(r.data) })); }
}
