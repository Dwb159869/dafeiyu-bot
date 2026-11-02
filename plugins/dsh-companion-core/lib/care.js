// 记忆库的保养（每天的任务里按间隔做）：
//   - 自动清理（默认每 7 天一次）：超过 90 天没被想起、重要程度（衰减后）低于 0.2 的记忆，按这个会话的遗忘方式处理
//     （主人的进普通遗忘，其他直接彻底遗忘）；可选：普通遗忘超过 180 天的自动彻底遗忘（默认关）。日记永远不清理。
//   - 定期整合（默认每 7 天一次）：同一归属里内容相近的零散记忆，让模型合并成更精炼的一两条；
//     原来的标成"被新的取代"（不再被想起，原文保留），能撤销最近一次。其他人的那些旧记忆到下一次整合时才彻底删掉。
import { complete, parseExtracted } from './extract.js';
import { effectiveImportance } from './recall.js';
import { overlap } from './text.js';
const DAY = 86_400_000;
export function mergePrompt(items) {
    return [
        '下面是你记忆里内容相近或者有关联的几条。请把它们整理成更精炼的一到两条：合并重复的，保留所有还有用的细节（名字、日期、数字、原话）；',
        '如果互相矛盾，以时间晚的为准（括号里是写下的日期）。',
        '',
        ...items.map(m => '- （' + new Date(m.createdAt).toISOString().slice(0, 10) + '）' + m.content),
        '',
        '只输出一个 JSON 数组：[{"content": "……", "kind": "fact|preference|event|promise|other", "importance": 0到1}]',
    ].join('\n');
}
/** 按内容相近程度分组（同一归属、正常状态、不含日记）；每组 2～8 条。 */
export function similarGroups(items, threshold, maxGroups) {
    const parent = new Map();
    const find = (x) => {
        while (parent.get(x) !== x)
            x = parent.get(x);
        return x;
    };
    for (const m of items)
        parent.set(m.id, m.id);
    for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
            if (items[i].scope !== items[j].scope)
                continue;
            if (overlap(items[i].content, items[j].content) >= threshold)
                parent.set(find(items[i].id), find(items[j].id));
        }
    }
    return [...Map.groupBy(items, m => find(m.id)).values()].filter(g => g.length >= 2).map(g => g.slice(0, 8)).slice(0, Math.max(0, maxGroups));
}
export class Care {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    /** 自动清理。 */
    cleanup(now = Date.now()) {
        const s = this.deps.settings();
        const report = { forgotten: 0, purged: 0 };
        if (!s.cleanupEnabled)
            return report;
        const rows = this.deps.store.list({ status: 'active', limit: 200, offset: 0 });
        const all = [...rows.items];
        for (let offset = 200; offset < rows.total; offset += 200)
            all.push(...this.deps.store.list({ status: 'active', limit: 200, offset }).items);
        for (const m of all) {
            if (m.kind === 'diary')
                continue;
            const idle = (now - (m.lastRecalled ?? m.createdAt)) / DAY;
            if (idle < s.cleanupDays || effectiveImportance(m, s.halfLifeDays, now) >= s.cleanupImportance)
                continue;
            if (s.forgetMode(m.scope) === 'purge') {
                if (this.deps.store.purge(m.id))
                    report.purged += 1;
            }
            else if (this.deps.store.forget(m.id))
                report.forgotten += 1;
        }
        if (s.purgeForgottenEnabled) {
            for (const m of this.deps.store.list({ status: 'forgotten', limit: 200 }).items) {
                if (m.kind !== 'diary' && m.forgottenAt !== undefined && now - m.forgottenAt > s.purgeForgottenDays * DAY && this.deps.store.purge(m.id))
                    report.purged += 1;
            }
        }
        if (report.forgotten + report.purged > 0)
            this.deps.log('info', '自动清理：普通遗忘 ' + report.forgotten + ' 条，彻底遗忘 ' + report.purged + ' 条');
        return report;
    }
    /** 定期整合。 */
    async consolidate(now = Date.now()) {
        const s = this.deps.settings();
        const report = { groups: 0, merged: 0, created: 0, purgedOld: 0 };
        if (!s.consolidateEnabled)
            return report;
        // 上一次（没撤销的）整合里，"彻底遗忘"归属的旧记忆现在删掉（撤销窗口过了）
        for (const r of this.deps.db.prepare("SELECT id, scope, old_ids FROM consolidations WHERE state = 'done'").all()) {
            if (s.forgetMode(r.scope) === 'purge')
                for (const id of JSON.parse(r.old_ids))
                    if (this.deps.store.purge(id))
                        report.purgedOld += 1;
            this.deps.db.prepare("UPDATE consolidations SET state = 'final' WHERE id = ?").run(r.id);
        }
        const llm = this.deps.llm();
        const target = this.deps.target();
        if (llm === undefined || target === undefined)
            throw new Error('没有可用的模型');
        const active = [];
        const total = this.deps.store.list({ status: 'active', limit: 1 }).total;
        for (let offset = 0; offset < total; offset += 200)
            active.push(...this.deps.store.list({ status: 'active', limit: 200, offset }).items.filter(m => m.kind !== 'diary'));
        for (const group of similarGroups(active, s.consolidateOverlap, s.consolidateGroups)) {
            const merged = parseExtracted(await complete(llm, target, mergePrompt(group))).slice(0, 2);
            if (merged.length === 0)
                continue;
            const scope = group[0].scope;
            const oldIds = group.map(m => m.id);
            // 新写的（added）撤销时要删；合并进已有记忆的（merged）只当作"保留那条"，撤销时不能删
            const created = [];
            const kept = [];
            const importance = Math.max(...group.map(m => m.importance));
            for (const e of merged) {
                const r = this.deps.store.add({ scope, kind: e.kind, content: e.content, importance: Math.max(importance, e.importance), trust: Math.max(...group.map(m => m.trust)), writer: 'consolidate' });
                if (r.action === 'added')
                    created.push(r.id);
                else if (r.action === 'merged')
                    kept.push(r.id);
            }
            const by = created[0] ?? kept[0];
            if (by === undefined)
                continue;
            const superseded = oldIds.filter(id => !kept.includes(id));
            for (const id of superseded)
                this.deps.db.prepare('UPDATE memories SET superseded_by = ? WHERE id = ?').run(by, id);
            this.deps.db.prepare('INSERT INTO consolidations (at, scope, old_ids, new_ids) VALUES (?, ?, ?, ?)').run(now, scope, JSON.stringify(superseded), JSON.stringify(created));
            report.groups += 1;
            report.merged += superseded.length;
            report.created += created.length;
        }
        this.deps.store.version += 1;
        if (report.groups > 0)
            this.deps.log('info', '定期整合：' + report.groups + ' 组，' + report.merged + ' 条合成了 ' + report.created + ' 条');
        return report;
    }
    /** 最近一次整合（同一次运行里的所有组），可以撤销的。 */
    lastRun() {
        const row = this.deps.db.prepare("SELECT MAX(at) AS at FROM consolidations WHERE state = 'done'").get();
        if (row.at === null)
            return undefined;
        const rows = this.deps.db.prepare("SELECT scope, old_ids, new_ids FROM consolidations WHERE state = 'done' AND at = ?").all(row.at);
        const load = (ids) => ids.map(id => this.deps.store.get(id)).filter((m) => m !== undefined);
        return { at: Number(row.at), groups: rows.map(r => ({ scope: r.scope, old: load(JSON.parse(r.old_ids)), created: load(JSON.parse(r.new_ids)) })) };
    }
    /** 撤销最近一次整合：删掉合成出来的，旧的恢复。 */
    undoLast() {
        const row = this.deps.db.prepare("SELECT MAX(at) AS at FROM consolidations WHERE state = 'done'").get();
        if (row.at === null)
            return 0;
        const rows = this.deps.db.prepare("SELECT id, old_ids, new_ids FROM consolidations WHERE state = 'done' AND at = ?").all(row.at);
        for (const r of rows) {
            for (const id of JSON.parse(r.new_ids)) {
                this.deps.db.prepare('UPDATE memories SET superseded_by = NULL WHERE superseded_by = ?').run(id);
                this.deps.db.prepare('DELETE FROM memories WHERE id = ?').run(id);
            }
            for (const id of JSON.parse(r.old_ids))
                this.deps.db.prepare('UPDATE memories SET superseded_by = NULL WHERE id = ?').run(id);
            this.deps.db.prepare("UPDATE consolidations SET state = 'undone' WHERE id = ?").run(r.id);
        }
        this.deps.store.version += 1;
        this.deps.log('info', '撤销了最近一次定期整合（' + rows.length + ' 组）');
        return rows.length;
    }
}
