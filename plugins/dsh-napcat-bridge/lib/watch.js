// 本插件新增：QQ 小号掉线检测。三路一起看：
//   1. NapCat 主动报的下线通知（notice.bot_offline，被踢、登录失效时会发）——马上算掉线；
//   2. NapCat 每 30 秒的心跳（meta_event.heartbeat）里的 status.online；
//   3. 定时自己问一次（get_status，问不到再 get_login_info）；NapCat 根本没连上来也算一种问题。
// 问题持续超过「宽限」才提醒（重启、网络抖一下不吵你）；还没好时每隔几小时再提醒一次；恢复后发一条「恢复了」。
// 刚启动的头几分钟不提醒（NapCat 还在连）。
const MIN = 60_000;
const CALL_TIMEOUT = 8000;
export class Watchdog {
    deps;
    st;
    startedAt;
    busy = false;
    constructor(deps) {
        this.deps = deps;
        this.startedAt = this.now();
        this.st = { state: 'unknown', since: this.startedAt };
    }
    now() { return this.deps.now?.() ?? Date.now(); }
    status() { return { ...this.st }; }
    /** NapCat 的下线通知 */
    onOffline(event) {
        const reason = [event.tag, event.message].filter(x => typeof x === 'string' && x.trim()).join('：') || 'NapCat 报告小号下线';
        this.deps.log('warn', 'QQ 小号下线：' + reason);
        this.set('offline', reason, event.self_id !== undefined ? { userId: String(event.self_id) } : undefined);
        void this.evaluate();
    }
    /** NapCat 的心跳 */
    onHeartbeat(event) {
        const online = event.status?.online;
        if (online === false)
            this.set('offline', '心跳里报告不在线', event.self_id !== undefined ? { userId: String(event.self_id) } : undefined);
        else if (online === true && this.st.state !== 'ok')
            this.set('ok', undefined, event.self_id !== undefined ? { userId: String(event.self_id) } : undefined);
    }
    /** 定时检查：自己问一次，再看要不要提醒。 */
    async check() {
        if (this.busy)
            return this.status();
        this.busy = true;
        try {
            this.st.lastCheck = this.now();
            const conns = this.deps.connections();
            if (conns.length === 0) {
                this.set('disconnected', 'NapCat 没有连上本插件');
            }
            else {
                const selfId = conns[0].selfId;
                try {
                    const st = await withTimeout(this.deps.callAction('get_status', { self_id: selfId }));
                    if (st && typeof st === 'object' && st.online === false)
                        this.set('offline', 'NapCat 报告小号不在线', { userId: selfId });
                    else {
                        let nickname;
                        try {
                            nickname = String((await withTimeout(this.deps.callAction('get_login_info', { self_id: selfId })))?.nickname ?? '') || undefined;
                        }
                        catch { /* 拿不到昵称不要紧 */ }
                        // 下线通知之后，要真的问到在线才算恢复
                        this.set('ok', undefined, { userId: selfId, ...(nickname ? { nickname } : {}) });
                    }
                }
                catch (e) {
                    this.set('unknown', '问 NapCat 没有回应：' + (e instanceof Error ? e.message : String(e)), { userId: selfId });
                }
            }
            await this.evaluate();
            return this.status();
        }
        finally {
            this.busy = false;
        }
    }
    set(state, reason, account) {
        const acc = account ? { ...this.st.account, ...account } : this.st.account;
        // 已经因为下线通知判成掉线的，定时检查问到「在线」之前不被心跳之外的「没回应」改写原因
        if (state === this.st.state) {
            if (reason !== undefined && state !== 'offline')
                this.st.reason = reason;
            if (acc)
                this.st.account = acc;
            return;
        }
        this.st = { state, since: this.now(), ...(reason ? { reason } : {}), ...(acc ? { account: acc } : {}), ...(this.st.lastCheck ? { lastCheck: this.st.lastCheck } : {}), ...(this.st.lastAlert ? { lastAlert: this.st.lastAlert } : {}),
            // 问题换了一种（比如没回应 → 掉线），已经提醒过的记录保留，不重复吵
            ...(state !== 'ok' && this.st.alertedAt ? { alertedAt: this.st.alertedAt } : {}) };
        if (state === 'ok' && this.pendingRecover) {
            this.pendingRecover = false;
            void this.send('recovered');
        }
    }
    pendingRecover = false;
    /** 看要不要发提醒 */
    async evaluate() {
        const s = this.deps.settings();
        if (!s.enabled || this.st.state === 'ok')
            return;
        const now = this.now();
        if (now - this.startedAt < Math.max(1, s.graceMinutes) * MIN)
            return;
        if (this.st.state !== 'offline' && now - this.st.since < Math.max(0, s.graceMinutes) * MIN)
            return;
        const repeat = s.repeatHours > 0 ? s.repeatHours * 60 * MIN : Infinity;
        if (this.st.alertedAt !== undefined && now - this.st.alertedAt < repeat)
            return;
        this.st.alertedAt = now;
        this.pendingRecover = s.alertOnRecover;
        await this.send('problem');
    }
    async send(kind) {
        try {
            const results = await this.deps.alert(kind, this.status());
            this.st.lastAlert = { at: this.now(), kind, results };
            this.deps.log(kind === 'problem' ? 'warn' : 'info', (kind === 'problem' ? '已发掉线提醒：' : '已发恢复提醒：') + (results.join('；') || '没有设置提醒渠道'));
        }
        catch (e) {
            this.deps.log('warn', '发提醒失败：' + (e instanceof Error ? e.message : String(e)));
        }
    }
}
function withTimeout(p) {
    return Promise.race([p, new Promise((_, reject) => setTimeout(() => reject(new Error(CALL_TIMEOUT / 1000 + ' 秒内没有回应')), CALL_TIMEOUT))]);
}
