// 记忆生成（"整理"）：把一段还没整理过的聊天交给模型，挑出值得记的写进记忆库。
// 什么时候整理：每 N 轮一次、截断/压缩之前（先抢救）、设置页「立即整理」。以后还有写日记时、存档到期前。
// QQ 会话从消息存档里取（含没唤醒她的群消息），每个会话记一个「已整理到哪条」，同一段只整理一次；
// dsh 里直接开的会话没有消息存档，从会话事件里记进「聊天流水」表（journal，只给整理和写日记用），同样记着整理到哪条。
// 所有整理排队一个一个来，不会同时打很多模型请求。
import { complete, extractionPrompt, parseExtracted, whoText } from './extract.js';
import { defaultTrust, ownScope } from './memory.js';
/** 一次最多交给模型多少条消息；更多的分几次。 */
const CHUNK = 300;
const MAX_CHUNKS = 5;
const CATEGORY_CODE = { master: 1, private: 2, group: 3 };
function timeText(ms) {
    const d = new Date(ms);
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}
export function transcriptOf(rows) {
    return rows.map(r => {
        const who = r.direction === 'out' ? '我' : (r.senderName || '某人') + '(' + r.senderId + ')';
        const body = r.type === 'notice' ? '（通知）' + r.text : r.text;
        return '[' + timeText(r.time) + '] ' + who + '：' + (body.trim() === '' ? '[图片/语音/视频等]' : body);
    });
}
export class Organizer {
    deps;
    queue = Promise.resolve();
    replies = new Map();
    constructor(deps) {
        this.deps = deps;
    }
    /** 排队执行。 */
    enqueue(task) {
        const next = this.queue.then(task, task);
        this.queue = next.catch(() => undefined);
        return next;
    }
    /** 记下一个 QQ 会话属于哪一类（存档里只有私聊/群，分不出主人）。 */
    rememberCategory(umo, category) {
        const key = 'cat:' + umo;
        if (this.deps.archive.cursor(key) !== CATEGORY_CODE[category])
            this.deps.archive.setCursor(key, CATEGORY_CODE[category]);
    }
    categoryOf(umo, kind) {
        const code = this.deps.archive.cursor('cat:' + umo);
        if (code === 1)
            return 'master';
        if (code === 3 || kind === 'group')
            return 'group';
        return 'private';
    }
    async write(scope, lines, source) {
        const llm = this.deps.llm();
        const target = this.deps.target();
        if (llm === undefined || target === undefined)
            throw new Error('没有可用的模型（dsh 的模型服务或默认模型没设好）');
        const own = ownScope(scope);
        const existing = this.deps.store.active([own]).sort((a, b) => b.createdAt - a.createdAt).slice(0, 40).map(m => m.content);
        const who = whoText(scope.category, scope.category === 'group' ? scope.groupId : scope.userId);
        const text = await complete(llm, target, extractionPrompt(lines, who, existing));
        let added = 0;
        for (const e of parseExtracted(text)) {
            const r = this.deps.store.add({
                scope: own, kind: e.kind, content: e.content, importance: e.importance, trust: defaultTrust(scope.category, 'organize'), writer: 'organize',
                ...(source.umo ? { sourceUmo: source.umo } : {}), ...(source.session ? { sourceSession: source.session } : {}),
                ...(source.from !== undefined ? { sourceFrom: source.from } : {}), ...(source.to !== undefined ? { sourceTo: source.to } : {}),
                ...(e.replaces ? { replaces: e.replaces } : {}),
            });
            if (r.action === 'added')
                added += 1;
        }
        if (added > 0)
            this.deps.afterWrite();
        return added;
    }
    /** 整理一个 QQ 会话里还没整理过的部分。返回新写了几条。 */
    organizeUmo(umo, reason) {
        return this.enqueue(async () => {
            const key = 'org:' + umo;
            let total = 0;
            for (let i = 0; i < MAX_CHUNKS; i++) {
                const rows = this.deps.archive.since(umo, this.deps.archive.cursor(key), CHUNK);
                if (rows.length === 0)
                    break;
                const kind = rows[0].kind;
                const category = this.categoryOf(umo, kind);
                const scope = category === 'group'
                    ? { category, qq: true, umo, groupId: rows[0].groupId ?? umo.split(':').pop() }
                    : { category, qq: true, umo, userId: rows[0].userId ?? umo.split(':').pop() };
                // 只有她发言或有人说话的段落才值得整理；全是通知就直接跳过
                if (rows.some(r => r.type === 'message')) {
                    total += await this.write(scope, transcriptOf(rows), { umo, from: rows[0].time, to: rows[rows.length - 1].time });
                }
                this.deps.archive.setCursor(key, rows[rows.length - 1].id);
                if (rows.length < CHUNK)
                    break;
            }
            this.replies.set(umo, 0);
            this.deps.log('info', '整理了 ' + umo + '（' + reason + '），新记了 ' + total + ' 条');
            return total;
        });
    }
    /** 整理一段直接给出的文字（dsh 会话）。 */
    organizeLines(scope, sessionId, lines, reason) {
        return this.enqueue(async () => {
            if (lines.length === 0)
                return 0;
            const n = await this.write(scope, lines, { session: sessionId });
            this.deps.log('info', '整理了会话 ' + sessionId + '（' + reason + '），新记了 ' + n + ' 条');
            return n;
        });
    }
    /** QQ：她回复了一次。到了 N 轮就整理（0 = 不按轮数整理）。 */
    onReply(umo, everyRounds) {
        const n = (this.replies.get(umo) ?? 0) + 1;
        this.replies.set(umo, n);
        if (everyRounds > 0 && n >= everyRounds) {
            this.replies.set(umo, 0);
            void this.organizeUmo(umo, '每 ' + everyRounds + ' 轮').catch(e => this.deps.log('warn', '整理失败：' + (e instanceof Error ? e.message : String(e))));
        }
    }
    /** dsh 会话：记下一句话（进聊天流水）；人说的话算一轮，到了 N 轮就整理。 */
    onDshLine(sessionId, text, human, everyRounds) {
        this.deps.archive.addJournal(sessionId, human ? 'master' : 'self', text);
        if (!human || everyRounds <= 0)
            return;
        const rows = this.deps.archive.journalSince(sessionId, this.deps.archive.cursor('orgdsh:' + sessionId), 10_000);
        if (rows.filter(r => r.role === 'master').length >= everyRounds) {
            void this.flushDsh(sessionId, '每 ' + everyRounds + ' 轮').catch(e => this.deps.log('warn', '整理失败：' + (e instanceof Error ? e.message : String(e))));
        }
    }
    /** 整理 dsh 会话流水里还没整理的部分；一条都没有时用 fallback（压缩前给的那几轮）。 */
    flushDsh(sessionId, reason, fallback = []) {
        return this.enqueue(async () => {
            const key = 'orgdsh:' + sessionId;
            const rows = this.deps.archive.journalSince(sessionId, this.deps.archive.cursor(key), CHUNK * MAX_CHUNKS);
            const lines = rows.length > 0 ? rows.map(r => '[' + timeText(r.time) + '] ' + (r.role === 'master' ? '主人' : '我') + '：' + r.text) : [...fallback];
            if (lines.length === 0)
                return 0;
            const n = await this.write({ category: 'master', qq: false }, lines, { session: sessionId, ...(rows.length > 0 ? { from: rows[0].time, to: rows[rows.length - 1].time } : {}) });
            if (rows.length > 0)
                this.deps.archive.setCursor(key, rows[rows.length - 1].id);
            this.deps.log('info', '整理了会话 ' + sessionId + '（' + reason + '），新记了 ' + n + ' 条');
            return n;
        });
    }
    /** 设置页「立即整理」：所有有新内容的 QQ 会话 + 所有攒着的 dsh 会话。 */
    async organizeAll() {
        let sessions = 0;
        let added = 0;
        for (const { umo, maxId } of this.deps.archive.umos()) {
            if (maxId <= this.deps.archive.cursor('org:' + umo))
                continue;
            sessions += 1;
            added += await this.organizeUmo(umo, '手动整理');
        }
        for (const { sessionId, maxId } of this.deps.archive.journalSessions()) {
            if (maxId <= this.deps.archive.cursor('orgdsh:' + sessionId))
                continue;
            sessions += 1;
            added += await this.flushDsh(sessionId, '手动整理');
        }
        return { sessions, added };
    }
    /** 还没整理的大概有多少（设置页显示）。 */
    pending() {
        let qqSessions = 0;
        let qqMessages = 0;
        for (const { umo, maxId } of this.deps.archive.umos()) {
            const c = this.deps.archive.cursor('org:' + umo);
            if (maxId > c) {
                qqSessions += 1;
                qqMessages += this.deps.archive.since(umo, c, 10_000).length;
            }
        }
        let dshSessions = 0;
        for (const { sessionId, maxId } of this.deps.archive.journalSessions())
            if (maxId > this.deps.archive.cursor('orgdsh:' + sessionId))
                dshSessions += 1;
        return { qqSessions, qqMessages, dshSessions };
    }
    /** 等排队的整理都做完（测试用）。 */
    async idle() {
        await this.queue;
    }
}
