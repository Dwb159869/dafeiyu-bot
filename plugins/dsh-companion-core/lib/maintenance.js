// 每天定时做的事（默认凌晨 1:30，一天按凌晨 4 点分界）：
//   1. 写日记：这段时间里她和主人的聊天（QQ 主人私聊 + dsh 里的会话）和新记的主人记忆 → 第一人称日记；
//      跨月时再写上个月的月度总览。日记永久保留，也写进记忆库（类型 diary）。
//   2. 存档到期：每个 QQ 会话按保留天数（主人默认 365 天，其他 5 天）——
//      先整理还没整理的 → 删掉到期的存档 → 这个 dsh 会话也用满了保留期就换新会话（开头带最近几句）→
//      旧会话归档；其他人的旧会话等它最后一条消息也过期后再删掉（主人的永不删）。
//   3. 清理：没被存档引用的图片文件、过期的聊天流水。
// 设置页可以「立即运行」。
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { diaryPrompt, logicalDay, monthPrompt } from './diary.js';
import { complete } from './extract.js';
import { transcriptOf } from './organizer.js';
const DAY = 86_400_000;
const errText = (e) => (e instanceof Error ? e.message : String(e));
function scopeOfUmo(umo, category) {
    const id = umo.split(':').pop() ?? '';
    return category === 'group' ? { category, qq: true, umo, groupId: id } : { category, qq: true, umo, userId: id };
}
export class Maintenance {
    deps;
    running;
    last;
    constructor(deps) {
        this.deps = deps;
    }
    /** 跑一遍（同时只跑一个）。 */
    run(now = Date.now(), what = 'all') {
        if (this.running !== undefined)
            return this.running;
        this.running = this.doRun(now, what).finally(() => { this.running = undefined; });
        return this.running;
    }
    async doRun(now, what) {
        const report = { at: now, expired: [], deletedSessions: [], failedSessions: [], mediaRemoved: 0 };
        if (what !== 'expire' && this.deps.settings().diaryEnabled) {
            try {
                report.diary = await this.writeDiary(now);
            }
            catch (e) {
                report.diary = { date: logicalDay(now, this.deps.settings().boundaryHour, this.deps.settings().timeZone), written: false, error: errText(e) };
                this.deps.log('warn', '写日记失败：' + errText(e));
            }
        }
        if (what !== 'diary')
            await this.expire(now, report);
        this.last = report;
        return report;
    }
    /** 主人的 QQ 会话（存档里记着类别是主人的）。 */
    masterUmos() {
        return this.deps.archive.umos().filter(u => this.deps.organizer.categoryOf(u.umo, u.kind) === 'master').map(u => u.umo);
    }
    //#region 日记
    async writeDiary(now) {
        const s = this.deps.settings();
        const { archive, diary, store } = this.deps;
        const date = logicalDay(now, s.boundaryHour, s.timeZone);
        const from = archive.cursor('diary:to') || now - 36 * 3_600_000;
        const rows = archive.between(this.masterUmos(), from, now);
        const journal = archive.journalBetween(from, now);
        const lines = [
            ...transcriptOf(rows).map((text, i) => ({ time: rows[i].time, text })),
            ...journal.map(j => ({ time: j.time, text: '[dsh] ' + (j.role === 'master' ? '主人' : '我') + '：' + j.text })),
        ].sort((a, b) => a.time - b.time).map(x => x.text);
        const memories = store.createdBetween('master', from, now).map(m => m.content);
        let month;
        if (lines.length === 0 && memories.length === 0) {
            archive.setCursor('diary:to', now);
            this.deps.log('info', date + ' 没有和主人的聊天，不写日记');
        }
        else {
            const llm = this.deps.llm();
            const target = this.deps.target();
            if (llm === undefined || target === undefined)
                throw new Error('没有可用的模型');
            const recent = diary.recentDays(3, date);
            let text = (await complete(llm, target, diaryPrompt(date, lines.slice(-600), memories, recent), 4096)).trim();
            if (text === '')
                throw new Error('模型没写出日记');
            const existing = diary.readDay(date);
            if (existing !== undefined && existing.trim() !== '')
                text = existing.trim() + '\n\n（后来又写了一段）\n\n' + text.replace(/^#.*\n+/, '');
            diary.writeDay(date, text);
            store.add({ scope: 'master', kind: 'diary', content: text, importance: 0.8, trust: 1, writer: 'diary', sourceFrom: from, sourceTo: now });
            archive.setCursor('diary:to', now);
            this.deps.log('info', '写好了 ' + date + ' 的日记（' + text.length + ' 字）');
        }
        // 跨月了：给上个月写总览
        if (s.monthlyEnabled) {
            const thisMonth = date.slice(0, 7);
            const done = diary.months();
            const pendingMonth = diary.days().map(d => d.slice(0, 7)).filter(m => m < thisMonth && !done.includes(m)).sort().pop();
            if (pendingMonth !== undefined) {
                const days = diary.days().filter(d => d.startsWith(pendingMonth)).sort().map(d => ({ date: d, text: diary.readDay(d) ?? '' }));
                const llm = this.deps.llm();
                const target = this.deps.target();
                if (llm !== undefined && target !== undefined && days.length > 0) {
                    const text = (await complete(llm, target, monthPrompt(pendingMonth, days), 4096)).trim();
                    if (text !== '') {
                        diary.writeMonth(pendingMonth, text);
                        store.add({ scope: 'master', kind: 'diary', content: text, importance: 0.9, trust: 1, writer: 'diary' });
                        month = pendingMonth;
                        this.deps.log('info', '写好了 ' + pendingMonth + ' 的月度总览');
                    }
                }
            }
        }
        return { date, written: lines.length > 0 || memories.length > 0, ...(month ? { month } : {}) };
    }
    //#endregion
    //#region 存档到期、换会话
    async expire(now, report) {
        const s = this.deps.settings();
        const { archive, organizer } = this.deps;
        for (const { umo, kind } of archive.umos()) {
            const category = organizer.categoryOf(umo, kind);
            const scope = scopeOfUmo(umo, category);
            const cutoff = now - Math.max(1, s.archiveDays(scope)) * DAY;
            const item = { umo, deleted: 0 };
            try {
                const oldest = archive.oldest(umo);
                const current = archive.currentSession(umo);
                // 已经换掉的旧会话（新会话还没有消息时，存档里最近的还是它）不再换第二次
                const needRotate = s.rotateSessions && current !== undefined && current.firstTime < cutoff && !archive.isRetired(current.sessionId);
                if ((oldest !== undefined && oldest < cutoff) || needRotate) {
                    // 先整理还没整理的部分（只整理没整理过的）
                    await organizer.organizeUmo(umo, '存档到期');
                }
                if (needRotate && current !== undefined) {
                    const rotate = this.deps.napcat()?.rotateSession;
                    if (rotate !== undefined) {
                        const recent = archive.recent(umo, Math.max(0, s.carryMessages));
                        if (recent.length > 0)
                            this.deps.setCarry(umo, transcriptOf(recent).join('\n'));
                        const r = await rotate(umo);
                        item.rotated = r.newSessionId;
                        archive.retire({ sessionId: r.oldSessionId, umo, category, lastTime: current.lastTime, state: 'archived' });
                        await this.archiveSession(r.oldSessionId);
                        this.deps.log('info', umo + ' 用满保留期，换到新会话 ' + r.newSessionId + '，旧会话 ' + r.oldSessionId + ' 已归档');
                    }
                }
                if (oldest !== undefined && oldest < cutoff) {
                    item.deleted = archive.deleteBefore(umo, cutoff);
                    if (item.deleted > 0)
                        this.deps.log('info', umo + ' 删掉了 ' + item.deleted + ' 条到期存档');
                }
            }
            catch (e) {
                item.error = errText(e);
                this.deps.log('warn', umo + ' 到期处理失败：' + item.error);
            }
            if (item.deleted > 0 || item.rotated || item.error)
                report.expired.push(item);
        }
        // 其他人的旧会话：最后一条消息也过期了就删掉（主人的永不删）
        if (s.deleteOldSessions) {
            for (const r of archive.retiredList()) {
                if (r.state !== 'archived' || r.category === 'master')
                    continue;
                const cutoff = now - Math.max(1, s.archiveDays(scopeOfUmo(r.umo, r.category))) * DAY;
                if (r.lastTime >= cutoff)
                    continue;
                try {
                    await this.deleteSession(r.sessionId);
                    archive.retire({ ...r, state: 'deleted' });
                    report.deletedSessions.push(r.sessionId);
                    this.deps.log('info', '删掉了已归档的旧会话 ' + r.sessionId);
                }
                catch (e) {
                    archive.retire({ ...r, state: 'failed', note: errText(e) });
                    report.failedSessions.push({ sessionId: r.sessionId, error: errText(e) });
                    this.deps.log('warn', '删旧会话 ' + r.sessionId + ' 失败（保留归档）：' + errText(e));
                }
            }
        }
        // 没被引用的图片、7 天前的聊天流水（已经整理过、写过日记）
        report.mediaRemoved = this.gcMedia();
        archive.deleteJournalBefore(Math.min(now - 7 * DAY, archive.cursor('diary:to') || now));
    }
    async archiveSession(id) {
        try {
            await this.deps.registry()?.archiveSession?.(id, { stopActivity: true });
        }
        catch (e) {
            this.deps.log('debug', '归档会话 ' + id + ' 时 dsh 说：' + errText(e));
        }
    }
    /**
     * 删一个已归档的旧会话（dsh 没有删除接口，这是我们自己的做法，端到端测试验证过）：
     * 确认不在跑 → 从工作区移除 → 删掉会话文件夹 → 从归档列表去掉 → 确认 dsh 查不到它了、列表还正常。
     * 只删插件一建的 QQ 会话（id 以 napcat- 开头），文件夹必须在 <DSH_HOME>/sessions 里。
     */
    async deleteSession(id) {
        if (!/^napcat-[A-Za-z0-9-]+$/.test(id))
            throw new Error('只删 dsh-napcat-bridge 建的会话');
        if (this.deps.isLive(id))
            throw new Error('会话还在跑');
        const registry = this.deps.registry();
        for (const ws of registry?.list?.() ?? []) {
            if (ws.sessionIds.includes(id))
                await ws.detachSession?.(id);
        }
        const root = resolve(this.deps.sessionsRoot);
        const dirs = [];
        if (existsSync(root)) {
            for (const project of readdirSync(root)) {
                const candidate = resolve(root, project, id);
                if (candidate.startsWith(root + sep) && existsSync(candidate) && statSync(candidate).isDirectory())
                    dirs.push(candidate);
            }
        }
        if (dirs.length === 0)
            throw new Error('没找到会话文件夹');
        for (const d of dirs)
            rmSync(d, { recursive: true, force: true });
        try {
            await registry?.unarchiveSession?.(id);
        }
        catch { /* 已经不在归档里 */ }
        const persistence = this.deps.persistence();
        if (persistence !== undefined) {
            if (await persistence.stat(id) !== undefined)
                throw new Error('删了文件夹，dsh 还能查到这个会话');
            await persistence.list?.();
        }
    }
    /** 删掉没被存档引用的图片，返回删了几个。 */
    gcMedia() {
        const dir = this.deps.mediaDir;
        if (!existsSync(dir))
            return 0;
        const refs = this.deps.archive.mediaRefs();
        let n = 0;
        for (const name of readdirSync(dir)) {
            if (refs.has(name))
                continue;
            rmSync(join(dir, name), { force: true });
            n += 1;
        }
        return n;
    }
}
