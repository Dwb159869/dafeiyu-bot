// dsh 一侧：替代 AstrBot 的事件队列和流水线里与"消息进出"有关的部分。
// 一条消息依次经过（顺序同 AstrBot STAGES_ORDER）：
//   唤醒（WakingCheckStage）→ 白名单（WhitelistCheckStage）→ 指令（builtin_commands）
//   → 只 @ 不说话时等下一条（handle_empty_mention）→ 频率限制（RateLimitStage）
//   → 语音转文字（PreProcessStage）→ 交给 unified_msg_origin 对应的 dsh 会话。
// 每条转换好的消息都通过 ctx 事件 'napcat/message' 广播（给记忆等其他插件用）。
// 交给模型前先发 'napcat/prompt'，其他插件可以往内容里加东西（本插件新增）。
// 会话一轮结束时，把模型最后一条回复的文字原样发回，并发 'napcat/sent'（本插件新增）。
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import { SessionId } from '@deepseek-ai/dsh-session';
import { MessageType, sessionToString, } from './adapter.js';
import { At, Plain, make } from './components.js';
import { extractForwards, extractQuoted } from './quoted.js';
import { Pacer, splitTyping } from './pacer.js';
import { segmentEnabled, splitReply } from './segment.js';
import { planPieces, ttsActive, ttsHint } from './tts.js';
import { TtlCache } from './cache.js';
/** 'napcat/prompt' 监听者最多等多久，超时就按当时的内容发出去。 */
const PROMPT_HOOK_MS = 30_000;
/** AstrBot handle_empty_mention 让模型主动问一句时用的提示词（原文）。 */
const EMPTY_MENTION_PROMPT = '注意，你正在社交媒体上中与用户进行聊天，用户只是通过@来唤醒你，但并未在这条消息中输入内容，他可能会在接下来一条发送他想发送的内容。'
    + '你友好地询问用户想要聊些什么或者需要什么帮助，回复要符合人设，不要太过机械化。'
    + '请注意，你仅需要输出要回复用户的内容，不要输出其他任何东西';
/** AstrBot @session_waiter(60) */
const EMPTY_MENTION_WAIT_MS = 60_000;

/** 本插件新增：一轮跑太久还没出声时，先发一句进度提示，免得对方以为掉线。
 *  除了「开始用工具」触发，还挂了一个 10 秒的心跳：单个工具跑很久（生图、装包）也不会一直哑着。 */
const PROGRESS_DEFAULT = { enabled: true, delaySeconds: 6, minGapSeconds: 20, maxPerTurn: 4, heartbeatSeconds: 10 };
const PROGRESS_POOLS = [
    { test: /^(image_generate|image_library)$/u, lines: ['（在生图，得等半分钟）', '（画着呢，等我一下）'] },
    { test: /^(bash|pwsh|admin_sh|admin_sudo)\b/u, lines: ['（翻着东西，等我一下）', '（我看看啊）', '（在弄了在弄了）'] },
    { test: /^(meme_|vault_)/u, lines: ['（我挑挑表情）', '（找找图）'] },
    { test: /^(web_search|web_fetch)$/u, lines: ['（上网查一下）', '（搜搜看）'] },
    { test: /^(mind_|memory_|life_|schedule_|proactive_|qq_|qzone_)/u, lines: ['（让我想一下）', '（稍等，我理理）'] },
];
const PROGRESS_FALLBACK = ['（等一下下）', '（在想了）'];
/** 去掉上下文代理塞进消息里的 acp 标记（<acp tokens=".." type="text">m00123</acp>）。
 *  只清这个形状，别的一概不动。 */
const ACP_TAG_RE = /<acp\b[^>]*>[\s\S]*?<\/acp>/gi;
const ACP_FRAGMENT_RE = /[^\n]{0,40}type="[a-z]+">m\d{5}[^\n]*/g;
const sanitizeOutbound = (text) => String(text)
    .replace(ACP_TAG_RE, '')
    .replace(ACP_FRAGMENT_RE, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
/** 当前时间，格式同 AstrBot：2026-10-23 21:40 (GMT+8), Weekday: Friday */
export function formatNow(timezone, now = new Date()) {
    const make = (tz) => new Intl.DateTimeFormat('en-US', {
        timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
        hour12: false, weekday: 'long', timeZoneName: 'short',
    });
    let fmt;
    try {
        fmt = make(timezone || undefined);
    }
    catch {
        fmt = make(undefined);
    }
    const p = {};
    for (const part of fmt.formatToParts(now))
        p[part.type] = part.value;
    const hour = p.hour === '24' ? '00' : p.hour;
    return p.year + '-' + p.month + '-' + p.day + ' ' + hour + ':' + p.minute + ' (' + p.timeZoneName + '), Weekday: ' + (p.weekday ?? WEEKDAYS[now.getDay()]);
}
/** "provider/model" → agentOptions；格式不对返回 undefined。 */
function parseModel(text) {
    const i = text.indexOf('/');
    if (i <= 0 || i === text.length - 1)
        return undefined;
    return { provider: text.slice(0, i).trim(), model: text.slice(i + 1).trim() };
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const errText = (e) => (e instanceof Error ? e.message : String(e));
/** dsh 会话 id：napcat-<平台>-<类型>-<会话> 去掉不安全字符。 */
export function dshSessionId(umo) {
    return 'napcat-' + umo.replace(/[^A-Za-z0-9-]/g, '-');
}
/**
 * WakingCheckStage.process 中与唤醒有关的部分（AstrBot 默认配置）。
 * 返回 null 表示不唤醒；否则返回处理后的 message_str（去掉了唤醒前缀）。
 */
export function wakingCheck(event, wake) {
    if (wake.ignoreBotSelfMessage && event.getSelfId() === event.getSenderId()) {
        return { isWake: false, messageStr: event.message_str, stop: true, prefixUsed: false };
    }
    let messageStr = event.message_str.trim();
    const messages = event.message_obj.message;
    let isWake = false;
    let prefixUsed = false;
    for (const prefix of wake.wakePrefix) {
        if (messageStr.startsWith(prefix)) {
            const first = messages[0];
            if (!event.isPrivateChat()
                && first !== undefined && first.type === 'At'
                && String(first.qq) !== String(event.getSelfId())
                && String(first.qq) !== 'all') {
                // 如果是群聊，且第一个消息段是 At 消息，但不是 At 机器人或 At 全体成员，则不唤醒
                break;
            }
            isWake = true;
            prefixUsed = true;
            messageStr = messageStr.slice(prefix.length).trim();
            break;
        }
    }
    if (!isWake) {
        // 检查是否有at消息 / at全体成员消息 / 引用了bot的消息
        for (const m of messages) {
            // AstrBot 这里还判断 isinstance(m, AtAll)，但 aiocqhttp 适配器把 @全体 转成 At(qq="all")
            // 而不是 AtAll，所以 @全体 实际不会唤醒；这里保持同样的结果。
            if ((m.type === 'At' && String(m.qq) === String(event.getSelfId()))
                || (m.type === 'Reply' && String(m.sender_id) === String(event.getSelfId()))) {
                isWake = true;
                break;
            }
        }
        // 检查是否是私聊
        if (event.isPrivateChat() && !wake.friendMessageNeedsWakePrefix)
            isWake = true;
        // 本插件新增：只匹配群消息正文，不把 @ 对象昵称等转换后生成的文字当成唤醒词。
        if (!isWake && !event.isPrivateChat()) {
            // 不跨非正文消息段拼词；交给模型的 messageStr 仍保留 @对象，避免丢失语义。
            const lower = messages.filter(m => m.type === 'Plain').map(m => String(m.text ?? '')).join('\n').toLowerCase();
            if ((wake.wakeKeywords ?? []).some(k => k.trim() !== '' && lower.includes(k.trim().toLowerCase())))
                isWake = true;
        }
    }
    return { isWake, messageStr, stop: false, prefixUsed };
}
/** 旧混合名单迁移：完整标识按类型分开，裸号码保留旧版两种匹配含义。 */
export function legacyWhitelistFor(ids, type) {
    return ids.map(String).map(x => x.trim()).filter(x => x !== '' && (!x.includes(':') || x.split(':')[1] === type));
}
export class Bridge {
    deps;
    chats = new Map();
    bySession = new Map();
    creating = new Map();
    /** dsh 会话 id → QQ 会话信息（建会话之前就登记，预设里的插件启动时就能查到） */
    infos = new Map();
    /** 只 @ 不说话的人：key = 会话|QQ 号，值 = 等到什么时候 */
    waiters = new Map();
    /** 频率限制：每个会话最近处理的时间 */
    timestamps = new Map();
    off;
    pacer;
    constructor(deps) {
        this.deps = deps;
        this.pacer = new Pacer({ settings: () => deps.settings().pace, log: deps.log, ...(deps.sleep ? { sleep: deps.sleep } : {}) });
        this.off = deps.onSessionEvent((session, event) => this.onSessionEvent(session, event));
    }
    /** unified_msg_origin；开了 unique_session 时群里按 QQ号_群号 分会话（同 AstrBot）。 */
    umoOf(event, s) {
        if (s.uniqueSession && event.message_obj.type === MessageType.GROUP_MESSAGE) {
            return sessionToString({ ...event.session, session_id: event.getSenderId() + '_' + event.getGroupId() });
        }
        return event.unified_msg_origin;
    }
    isAdmin(event, s) {
        return s.admins.includes(event.getSenderId());
    }
    /** 管理员始终豁免；普通群聊/私聊分别只查对应名单。群豁免必须来自真实来信发送者。 */
    canSend(session, senderId) {
        return this.checkAccess(session, senderId, true);
    }
    /** 本插件新增：存档按会话检查；群聊不继承管理员发言豁免，管理员私聊仍允许。 */
    canArchive(session) {
        return this.checkAccess(session, undefined, false);
    }
    checkAccess(session, senderId, logDenied) {
        const s = this.deps.settings();
        const id = String(session.session_id).trim();
        const isGroup = session.message_type === MessageType.GROUP_MESSAGE;
        const adminId = isGroup ? senderId : id;
        if (adminId !== undefined && s.admins.includes(adminId))
            return true;
        const wl = s.whitelist;
        if (!wl.enabled)
            return true;
        const ids = (isGroup ? wl.groupIds : wl.privateIds).map(i => String(i).trim()).filter(Boolean);
        if (ids.includes(sessionToString(session)) || ids.includes(id))
            return true;
        if (logDenied && wl.log)
            this.deps.log('info', '会话 ' + sessionToString(session) + ' 不在' + (isGroup ? '群聊' : '私聊') + '白名单里，不唤醒也不发送消息。');
        return false;
    }
    /** 给其他插件代发时也检查，不能绕过群白名单。 */
    async sendBySession(session, chain) {
        if (!this.canSend(session))
            throw new Error('会话 ' + sessionToString(session) + ' 不在白名单里，禁止发送');
        await this.deps.sendBySession(session, chain);
    }
    /** RateLimitStage（固定窗口）。返回 false 表示这条被丢弃。 */
    async rateLimit(umo, s) {
        const { count, seconds, strategy } = s.rateLimit;
        if (count <= 0)
            return true;
        const windowMs = seconds * 1000;
        while (true) {
            const now = Date.now();
            const list = (this.timestamps.get(umo) ?? []).filter(t => t >= now - windowMs);
            this.timestamps.set(umo, list);
            if (list.length < count) {
                list.push(now);
                return true;
            }
            const wait = list[0] + windowMs - now + 300;
            if (strategy === 'discard') {
                this.deps.log('info', '会话 ' + umo + ' 触发频率限制，这条消息被丢弃，' + (wait / 1000).toFixed(1) + ' 秒后恢复。');
                return false;
            }
            this.deps.log('info', '会话 ' + umo + ' 触发频率限制，等 ' + (wait / 1000).toFixed(1) + ' 秒再处理。');
            await sleep(wait);
        }
    }
    /** 适配器 handle_msg 的去处。 */
    async handle(abm, event) {
        const s = this.deps.settings();
        const woke = wakingCheck(event, s.wake);
        let { isWake } = woke;
        const { stop, prefixUsed } = woke;
        let messageStr = woke.messageStr;
        const umo = this.umoOf(event, s);
        const isMessage = abm.raw_message.post_type === 'message';
        // 只 @ 过她的人，60 秒内的下一条有内容的消息算作唤醒（AstrBot 在下一条前插一个 @）
        const waiterKey = umo + '|' + event.getSenderId();
        const waitUntil = this.waiters.get(waiterKey);
        if (!stop && !isWake && isMessage && waitUntil !== undefined) {
            if (waitUntil < Date.now()) {
                this.waiters.delete(waiterKey);
            }
            else if (messageStr.trim() !== '') {
                this.waiters.delete(waiterKey);
                isWake = true;
            }
        }
        try {
            this.deps.emit(abm, event, isWake && !stop);
        }
        catch (e) {
            this.deps.log('warn', 'napcat/message 监听器出错: ' + errText(e));
        }
        if (stop || !isWake)
            return;
        // 只有消息事件交给模型；通知/请求只广播
        if (!isMessage)
            return;
        const admin = this.isAdmin(event, s);
        if (!this.canSend(event.session, event.getSenderId()))
            return;
        if (s.commands.enabled && prefixUsed && await this.command(messageStr, event, umo, admin, s))
            return;
        if (s.emptyMention.waiting && this.isEmptyMention(abm, event, s)) {
            this.waiters.set(waiterKey, Date.now() + EMPTY_MENTION_WAIT_MS);
            if (s.emptyMention.needReply)
                await this.dispatch(event, umo, abm, [{ type: 'text', text: EMPTY_MENTION_PROMPT }]);
            return;
        }
        if (!admin && !await this.rateLimit(umo, s))
            return;
        // 语音转文字（PreProcessStage）
        for (const record of abm.message.filter(c => c.type === 'Record')) {
            const piece = await this.deps.media.voiceText(record);
            messageStr = messageStr === '' ? piece : messageStr + ' ' + piece;
        }
        const own = abm.message.filter(c => c.type === 'Image');
        const videos = abm.message.filter(c => c.type === 'Video');
        const hasForward = abm.message.some(c => c.type === 'Forward');
        // 本插件新增：视频（AstrBot 不处理）在文字里写 [视频]，有 ffmpeg 时另外附几张截图
        for (let i = 0; i < videos.length; i++)
            messageStr = messageStr === '' ? '[视频]' : messageStr + ' [视频]';
        if (messageStr === '' && own.length === 0 && !hasForward)
            return;
        const content = await this.buildContent(abm, messageStr, own, videos, admin, s);
        await this.dispatch(event, umo, abm, content);
    }
    isEmptyMention(abm, event, s) {
        const messages = abm.message;
        if (messages.length !== 1)
            return false;
        const m = messages[0];
        if (m.type === 'At' && String(m.qq) === String(event.getSelfId()))
            return true;
        return m.type === 'Plain' && s.wake.wakePrefix.includes(String(m.text).trim());
    }
    targetOf(event, umo) {
        const isGroup = event.message_obj.type === MessageType.GROUP_MESSAGE;
        const isUnique = isGroup && umo !== event.unified_msg_origin;
        return {
            umo, session: event.session, isGroup, isUnique,
            ...(isGroup ? { groupId: String(event.getGroupId()) } : {}),
            ...(!isGroup ? { userId: String(event.message_obj.session_id) } : isUnique ? { userId: event.getSenderId() } : {}),
            senderId: event.getSenderId(),
            selfId: event.getSelfId(),
            send: chain => event.send(chain),
        };
    }
    async dispatch(event, umo, abm, content) {
        const target = this.targetOf(event, umo);
        if (!this.canSend(target.session, target.senderId))
            return;
        const chat = await this.ensureChat(target);
        chat.send = target.send;
        // 本插件新增：交给模型前让其他插件（记忆等）往内容里加东西
        const payload = { info: chat.info, newSession: chat.fresh, message: abm, content: [...content] };
        chat.fresh = false;
        chat.nudged = false;
        let timer;
        try {
            await Promise.race([
                this.deps.prompt(payload),
                new Promise(resolve => {
                    timer = setTimeout(() => {
                        this.deps.log('warn', 'napcat/prompt 监听器 ' + PROMPT_HOOK_MS / 1000 + ' 秒没有完成，先按现有内容发给模型');
                        resolve(undefined);
                    }, PROMPT_HOOK_MS);
                }),
            ]);
        }
        catch (e) {
            this.deps.log('warn', 'napcat/prompt 监听器出错: ' + errText(e));
        }
        finally {
            if (timer !== undefined)
                clearTimeout(timer);
        }
        const parts = Array.isArray(payload.content) ? [...payload.content] : content;
        const admitted = await this.deps.media.admit(parts);
        // 媒体转换、提示扩展或限频等待期间，用户可能已经移除了这个群。
        if (!this.canSend(target.session, target.senderId))
            return;
        chat.replySenders.add(target.senderId);
        chat.handle.agent.followup(createUserMessage({
            content: admitted,
            source: { kind: 'plugin:napcat-bridge', ...(target.isGroup ? { replyTo: { userId: target.senderId, messageId: abm.message_id } } : {}) },
        }));
    }
    /** QQ 里的指令。返回 true 表示已处理（不再交给模型）。 */
    async command(messageStr, event, umo, admin, s) {
        const name = messageStr.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
        if (!['help', 'sid', 'new', 'reset', 'stop'].includes(name))
            return false;
        const reply = (text) => (this.canSend(event.session, event.getSenderId()) ? event.send(this.groupReplyChain(text, event.message_obj.type === MessageType.GROUP_MESSAGE ? { userId: event.getSenderId(), messageId: event.message_obj.message_id } : undefined, s)) : Promise.resolve()).catch(e => {
            this.deps.log('error', '发送指令回复失败: ' + errText(e));
        });
        const isGroup = event.message_obj.type === MessageType.GROUP_MESSAGE;
        // AstrBot SHARED_GROUP_ADMIN：私聊谁都能用；群里要管理员（本插件也认 QQ 群主和群管理）
        const groupRole = String(event.message_obj.raw_message.sender?.role ?? '');
        const sharedAdmin = !isGroup || admin || groupRole === 'owner' || groupRole === 'admin';
        if ((name === 'new' || name === 'reset') && !sharedAdmin) {
            if (s.commands.noPermissionReply)
                await reply('只有管理员能在群里用 /' + name + '。');
            return true;
        }
        const chat = this.chats.get(umo);
        if (name === 'help') {
            await reply(['可用指令：', '/new  开始新的对话（旧对话保留在 dsh 里）', '/reset  同 /new', '/stop  停止她正在进行的回复', '/sid  查看本会话的标识'].join('\n'));
        }
        else if (name === 'sid') {
            const sessionId = chat !== undefined ? String(chat.handle.agent.session.id) : (this.deps.store.get(umo) ?? dshSessionId(umo));
            await reply(['会话标识：' + umo, '你的 QQ：' + event.getSenderId(), 'dsh 会话：' + sessionId].join('\n'));
        }
        else if (name === 'stop') {
            if (chat === undefined) {
                await reply('现在没有在进行的回复。');
            }
            else {
                chat.handle.agent.cancel({ kind: 'user' });
                await reply('已停止。');
            }
        }
        else {
            await this.startNewSession(umo, 'command');
            await reply('已开始新的对话。');
        }
        return true;
    }
    /** /new、/reset、rotateSession：换一个新的 dsh 会话，旧的留在 dsh 里。返回新旧会话 id。 */
    async startNewSession(umo, reason) {
        const pending = this.creating.get(umo);
        if (pending !== undefined)
            await pending.catch(() => undefined);
        const chat = this.chats.get(umo);
        const oldSessionId = chat !== undefined ? String(chat.handle.agent.session.id) : (this.deps.store.get(umo) ?? dshSessionId(umo));
        let next = dshSessionId(umo) + '-' + Date.now().toString(36);
        if (next === oldSessionId)
            next += '-1';
        this.deps.store.set(umo, next);
        if (chat !== undefined) {
            this.chats.delete(umo);
            this.bySession.delete(oldSessionId);
            await chat.handle.dispose().catch(e => this.deps.log('warn', '关闭旧会话失败: ' + errText(e)));
        }
        this.deps.log('info', umo + ' 换到新会话 ' + next);
        const change = { umo, oldSessionId, newSessionId: next, reason };
        try {
            this.deps.sessionChanged(change);
        }
        catch (e) {
            this.deps.log('warn', 'napcat/session-changed 监听器出错: ' + errText(e));
        }
        return { oldSessionId, newSessionId: next };
    }
    /** 给其他插件用：让某个 QQ 会话换一个新的 dsh 会话（下一条消息进新会话）。 */
    rotateSession(umo) {
        return this.startNewSession(umo, 'rotate');
    }
    /** 仅当前管理员的 QQ 私聊；不用存档分类或在线 chats 推测归属。 */
    masterPrivateBindings(platform) {
        return [...new Set(this.deps.settings().admins)].filter(id => /^\d+$/.test(id)).map(ownerId => {
            const umo = platform + ':FriendMessage:' + ownerId;
            const prefix = dshSessionId(umo);
            return { ownerId, prefix, sessionId: this.deps.store.get(umo) ?? prefix, cwd: this.deps.settings().cwd };
        });
    }
    /** 恢复后只接管当前管理员的私聊；原会话留存，不触发换会话的整理流程。 */
    async restoreMasterPrivateBinding(platform, ownerId, sessionId) {
        const binding = this.masterPrivateBindings(platform).find(b => b.ownerId === ownerId);
        if (!binding || !sessionId.startsWith(binding.prefix + '-import-'))
            throw new Error('只能恢复当前主人的私聊会话');
        const umo = platform + ':FriendMessage:' + ownerId;
        if (this.restoring.has(umo) || this.creating.has(umo) || this.chats.get(umo)?.running)
            throw new Error('主人私聊正在处理消息，请空闲后重新导入');
        if (!await this.deps.persistence()?.stat(sessionId))
            throw new Error('恢复的会话不存在');
        // 检查与锁定间不得等待；ensureChat 在切换完成前排队。
        if (this.restoring.has(umo) || this.creating.has(umo) || this.chats.get(umo)?.running)
            throw new Error('主人私聊正在处理消息，请稍后重试');
        const task = (async () => {
            const chat = this.chats.get(umo);
            if (chat) {
                await chat.handle.dispose();
                this.chats.delete(umo);
                this.bySession.delete(chat.info.sessionId);
            }
            this.deps.store.set(umo, sessionId);
        })();
        this.restoring.set(umo, task);
        try {
            await task;
        }
        finally {
            this.restoring.delete(umo);
        }
    }
    restoring = new Map();
    /** dsh 会话 id → QQ 会话信息。 */
    sessionInfo(sessionId) {
        return this.infos.get(sessionId);
    }
    /** QQ 会话（unified_msg_origin）→ 当前的会话信息。 */
    sessionInfoByUmo(umo) {
        const chat = this.chats.get(umo);
        if (chat !== undefined)
            return chat.info;
        const id = this.deps.store.get(umo) ?? dshSessionId(umo);
        return this.infos.get(id);
    }
    /** 她自己在各个群里的名片（群号 → 名片），10 分钟 */
    selfCards = new TtlCache(10 * 60_000, 500);
    /** 她自己在这个群里的群名片（没设名片用 QQ 昵称）；查不到返回空。 */
    async selfCard(groupId, selfId) {
        const hit = this.selfCards.get(groupId);
        if (hit !== undefined)
            return hit;
        let name = '';
        try {
            const info = await this.deps.callAction('get_group_member_info', { group_id: Number(groupId), user_id: Number(selfId), no_cache: false });
            name = String(info?.card || info?.nickname || '').trim();
        }
        catch {
            // 查不到就只写 QQ 号
        }
        this.selfCards.set(groupId, name);
        return name;
    }
    /**
     * 本插件新增：群里被 @ 或被引用叫醒时告诉她「这条是在叫你」，以及她自己的 QQ 号和群名片。
     * 叫醒她的那个 @ 会照 AstrBot 的做法从文字里去掉，剩下的 @ 都是别人（比如回复别人时 QQ 自动带上的 @），
     * 不说清楚的话她会以为这条是在叫别人。
     */
    async wakeNote(abm) {
        if (abm.type !== MessageType.GROUP_MESSAGE || !abm.group?.group_id)
            return undefined;
        const self = String(abm.self_id);
        const atSelf = abm.message.some(m => m.type === 'At' && String(m.qq) === self);
        const quotedSelf = abm.message.some(m => m.type === 'Reply' && String(m.sender_id) === self);
        if (!atSelf && !quotedSelf)
            return undefined;
        const card = await this.selfCard(String(abm.group.group_id), self);
        const how = atSelf && quotedSelf ? '@ 了你，还引用了你说过的话' : atSelf ? '@ 了你' : '引用了你说过的话';
        return '这条消息' + how + '，是在叫你。你在这个群里的 QQ 号是 ' + self + (card ? '，群名片「' + card + '」' : '')
            + '。叫你的那个 @ 已经从文字里去掉了，文字里剩下的 @ 是别人（比如回复别人时 QQ 自动带上的）。';
    }
    /** AstrBot _append_system_reminders；markAdmin、markWake 为本插件新增。 */
    async reminder(abm, admin, s) {
        const parts = [];
        if (s.reminder.markWake) {
            const note = await this.wakeNote(abm);
            if (note !== undefined)
                parts.push(note);
        }
        if (s.reminder.markAdmin && admin)
            parts.push('Sender role: admin (QQ ' + abm.sender.user_id + ')');
        if (s.reminder.groupName && abm.group?.group_name)
            parts.push('Group name: ' + abm.group.group_name);
        if (s.reminder.datetime)
            parts.push('Current datetime: ' + formatNow(s.reminder.timezone));
        const group = abm.type === MessageType.GROUP_MESSAGE;
        if (s.tts.mode === 'tag' && this.deps.tts && ttsActive(s.tts, { group, adminPrivate: admin && !group }))
            parts.push(ttsHint(s.tts));
        return parts.length > 0 ? '<system_reminder>' + parts.join('\n') + '</system_reminder>' : undefined;
    }
    /**
     * 交给模型的内容：（群里）[昵称(QQ号)] + 文字；有引用时接 <Quoted Message>（照 AstrBot），
     * 有聊天记录时接 <Forward Message>（本插件新增）；然后 <system_reminder>；最后是图片和视频截图。
     * 返回的内容还没交给 dsh 附件服务（dispatch 里统一交）。
     */
    async buildContent(abm, messageStr, own, videos, admin, s) {
        const settings = s;
        const callAction = this.deps.callAction;
        const safe = async (what, task) => {
            try {
                return await task();
            }
            catch (e) {
                this.deps.log('warn', what + '失败: ' + errText(e));
                return null;
            }
        };
        const quoted = await safe('整理引用内容', () => extractQuoted(abm.message, callAction));
        const forwarded = await safe('展开聊天记录', () => extractForwards(abm.message, callAction, undefined, abm.message_id));
        // 本插件新增：取聊天记录出错时记下来（以前悄悄失败，她只看到 [Forward Message]）
        for (const e of [...(quoted?.errors ?? []), ...(forwarded?.errors ?? [])])
            this.deps.log('warn', '展开聊天记录没取到：' + e);
        let text = messageStr;
        if (text === '' && own.length > 0)
            text = '[图片]';
        if (text === '' && forwarded !== null)
            text = '[聊天记录]';
        if (settings.identifier && abm.type === MessageType.GROUP_MESSAGE) {
            text = '[' + (abm.sender.nickname || abm.sender.user_id) + '(' + abm.sender.user_id + ')] ' + text;
        }
        const texts = [{ type: 'text', text }];
        if (quoted !== null)
            texts.push({ type: 'text', text: quoted.text });
        if (forwarded !== null)
            texts.push({ type: 'text', text: forwarded.text });
        const reminder = await this.reminder(abm, admin, s);
        if (reminder !== undefined)
            texts.push({ type: 'text', text: reminder });
        const asImage = (ref) => ({ type: 'Image', file: ref, url: ref.startsWith('http') ? ref : '', _type: '', path: '' });
        const quotedImages = (quoted?.imageRefs ?? []).map(asImage);
        const forwardImages = (forwarded?.imageRefs ?? []).map(asImage);
        const media = this.deps.media;
        if (!settings.imageToModel || !media.canAttach() || own.length + quotedImages.length + forwardImages.length + videos.length === 0) {
            return texts;
        }
        const parts = [...texts];
        let budget = settings.maxImages > 0 ? settings.maxImages : Infinity;
        let failed = 0;
        const add = async (images, label) => {
            const got = await media.convert(images, budget);
            budget -= got.used;
            failed += got.failed;
            if (got.parts.length === 0)
                return;
            if (label !== undefined)
                parts.push({ type: 'text', text: label });
            parts.push(...got.parts);
        };
        await add(own);
        await add(quotedImages, '（下面是被引用消息里的图片）');
        await add(forwardImages, '（下面是聊天记录里的图片）');
        // 本插件新增：视频截图（每个视频前面有一句说明）
        for (const video of videos) {
            if (budget <= 0)
                break;
            const v = await media.video(video, budget);
            budget -= v.parts.filter(p => p.type === 'image').length;
            parts.push(...v.parts);
        }
        if (failed > 0)
            parts.push({ type: 'text', text: '（有 ' + failed + ' 张图片没能读取）' });
        return parts;
    }
    ensureChat(target) {
        const umo = target.umo;
        const restoring = this.restoring.get(umo);
        if (restoring)
            return restoring.then(() => this.ensureChat(target));
        const pending = this.creating.get(umo);
        if (pending !== undefined)
            return pending;
        const existing = this.chats.get(umo);
        // 本插件新增：设置里的模型或思考等级改了，等这个会话不在回复时，关掉旧的连接、用新设置接回同一个会话（聊天记录不变）
        const stale = existing !== undefined && !existing.running && existing.modelKey !== this.modelFor(target).key;
        if (existing !== undefined && !stale)
            return Promise.resolve(existing);
        const task = (async () => {
            if (existing !== undefined) {
                this.chats.delete(umo);
                this.bySession.delete(String(existing.handle.agent.session.id));
                await existing.handle.dispose().catch(e => this.deps.log('warn', '关闭旧连接失败: ' + errText(e)));
                this.deps.log('info', umo + '：模型或思考等级改了，换成新设置（同一个会话）');
            }
            return this.createChat(target);
        })().finally(() => this.creating.delete(umo));
        this.creating.set(umo, task);
        return task;
    }
    /**
     * 本插件新增：其他插件主动唤醒她（比如定时主动聊天）。给这个 QQ 会话的 dsh 会话发一条内容（来源 plugin:napcat-bridge-wake），
     * 她一轮说完的回复照常发到 QQ；回复以「不发」暗号开头时不发。会话还没建过时先建。群里每人单独一个会话的 umo 不支持。
     */
    async wake(umo, content) {
        const parts = umo.split(':');
        if (parts.length !== 3)
            throw new Error('会话标识不对：' + umo);
        const [platform, type, id] = parts;
        if (type !== MessageType.GROUP_MESSAGE && type !== MessageType.FRIEND_MESSAGE)
            throw new Error('只能唤醒私聊或群聊：' + umo);
        if (id.includes('_'))
            throw new Error('不支持群里每人单独会话的唤醒：' + umo);
        const selfId = this.deps.selfId();
        if (selfId === undefined)
            throw new Error('NapCat 还没连上');
        const isGroup = type === MessageType.GROUP_MESSAGE;
        const session = { platform_name: platform, message_type: type, session_id: id };
        if (!this.canSend(session))
            throw new Error('会话 ' + umo + ' 不在白名单里，禁止主动唤醒');
        const send = (chain) => this.sendBySession(session, chain);
        const chat = await this.ensureChat({ umo, session, isGroup, isUnique: false, ...(isGroup ? { groupId: id } : { userId: id }), senderId: isGroup ? '' : id, selfId, send });
        const admitted = await this.deps.media.admit(typeof content === 'string' ? [{ type: 'text', text: content }] : content);
        if (!this.canSend(session))
            throw new Error('会话 ' + umo + ' 不在白名单里，禁止主动唤醒');
        chat.nudged = false;
        chat.handle.agent.followup(createUserMessage({ content: admitted, source: { kind: 'plugin:napcat-bridge-wake' } }));
        return { sessionId: String(chat.handle.agent.session.id) };
    }
    /** 这个会话该用的模型和思考等级：主人私聊 > 私聊/群聊 > dsh 默认模型（本插件新增思考等级）。 */
    modelFor(target) {
        const settings = this.deps.settings();
        const isGroup = target.isGroup;
        const adminPrivate = !isGroup && settings.admins.includes(target.senderId);
        const pick = (v) => (adminPrivate ? v.adminPrivate : '') || (isGroup ? v.group : v.private);
        const modelText = pick(settings.models);
        const chosen = modelText !== '' ? parseModel(modelText) : undefined;
        if (modelText !== '' && chosen === undefined)
            this.deps.log('warn', '模型「' + modelText + '」格式不对，应写成 提供方/模型；改用默认模型');
        const selection = chosen ?? this.deps.defaultModel()?.currentSelection();
        const effort = pick(settings.reasoning) || (selection !== undefined && 'reasoningEffort' in selection ? String(selection.reasoningEffort ?? '') : '');
        const agentOptions = selection ? { provider: selection.provider, model: selection.model, ...(effort ? { reasoningEffort: effort } : {}) } : undefined;
        return { agentOptions, modelText, chosen, key: agentOptions ? agentOptions.provider + '/' + agentOptions.model + '#' + (agentOptions.reasoningEffort ?? '') : '' };
    }
    async createChat(target) {
        const umo = target.umo;
        const settings = this.deps.settings();
        const sessionId = this.deps.store.get(umo) ?? dshSessionId(umo);
        const isGroup = target.isGroup;
        const adminPrivate = !isGroup && settings.admins.includes(target.senderId);
        // 预设和模型：主人私聊 > 私聊/群聊 > 默认 > dsh 当前的默认预设（网页里选的，没选过就是部署默认）
        const presets = this.deps.presets();
        const presetId = (adminPrivate ? settings.presets.adminPrivate : '') || (isGroup ? settings.presets.group : settings.presets.private) || settings.presets.default || presets?.defaultId || undefined;
        const { agentOptions, modelText, chosen, key: modelKey } = this.modelFor(target);
        const setup = presets !== undefined && presetId !== undefined
            ? (async (agentCtx) => { await presets.mount(agentCtx, presetId); })
            : undefined;
        // 本插件新增：建会话之前先登记它对应哪个 QQ 会话（预设里的插件在 setup 时就能查到）
        const info = {
            umo,
            sessionId,
            platformId: target.session.platform_name,
            selfId: target.selfId,
            type: isGroup ? 'group' : 'private',
            ...(target.groupId !== undefined ? { groupId: target.groupId } : {}),
            ...(target.userId !== undefined ? { userId: target.userId } : {}),
            adminPrivate,
        };
        this.infos.set(sessionId, info);
        const persistence = this.deps.persistence();
        const exists = persistence !== undefined && await persistence.stat(sessionId) !== undefined;
        let handle;
        // 本插件新增：这个会话已经在 dsh 里开着（比如 dsh 重启后网页先把它接上了），就直接用它，不再抢——
        // 抢会报「already owned by an active write handle」，消息就丢了。借用的会话不归本插件关。
        const borrow = () => {
            const live = this.deps.agents.get?.(SessionId(sessionId));
            return live === undefined ? undefined : { agent: live, dispose: async () => { } };
        };
        const borrowed = borrow();
        if (borrowed !== undefined) {
            handle = borrowed;
            this.deps.log('info', '会话 ' + sessionId + ' 已经在 dsh 里开着，直接接上（' + umo + '）');
        }
        else if (exists) {
            try {
                handle = await this.deps.agents.resume({ resumeSessionId: SessionId(sessionId), agentOptions: agentOptions, setup });
            }
            catch (e) {
                // 恢复的同时别处刚好把它打开了：再看一眼，有就接上
                const late = borrow();
                if (late === undefined)
                    throw e;
                handle = late;
            }
            this.deps.log('info', '恢复会话 ' + sessionId + '（' + umo + '）');
        }
        else {
            handle = await this.deps.agents.create({
                sessionId: SessionId(sessionId),
                meta: { cwd: settings.cwd, ...(presetId !== undefined ? { agentPreset: presetId } : {}) },
                agentOptions: agentOptions,
                setup,
            });
            this.deps.log('info', '新建会话 ' + sessionId + '（' + umo + (presetId ? '，预设 ' + presetId : '') + (chosen ? '，模型 ' + modelText : '') + (agentOptions?.reasoningEffort ? '，思考 ' + agentOptions.reasoningEffort : '') + '）');
        }
        const chat = { umo, session: target.session, handle, lastText: '', send: target.send, info, fresh: !exists, modelKey, running: false, replySenders: new Set() };
        this.chats.set(umo, chat);
        this.bySession.set(String(handle.agent.session.id), umo);
        return chat;
    }
    /** 本插件新增：够久没出声就先发一句进度提示。toolName 为空表示心跳触发（选通用词）。 */
    maybeProgress(chat, elapsedMs, toolName) {
        try {
            const cfg = { ...PROGRESS_DEFAULT, ...(this.deps.settings().progress ?? {}) };
            if (cfg.enabled === false || chat.running !== true)
                return;
            if (elapsedMs < cfg.delaySeconds * 1000)
                return;
            if ((chat.progressCount ?? 0) >= cfg.maxPerTurn)
                return;
            const now = Date.now();
            if (now - (chat.progressLast ?? 0) < cfg.minGapSeconds * 1000)
                return;
            const sender = [...(chat.replySenders ?? [])].find(id => this.deps.settings().admins.includes(id));
            if (!this.canSend(chat.session, sender))
                return;
            const pool = PROGRESS_POOLS.find(p => typeof toolName === 'string' && p.test.test(toolName));
            const lines = pool?.lines ?? PROGRESS_FALLBACK;
            const line = lines[(chat.progressCount ?? 0) % lines.length];
            chat.progressCount = (chat.progressCount ?? 0) + 1;
            chat.progressLast = now;
            const chain = { chain: [Plain(line)] };
            Promise.resolve(chat.send(chain))
                .then(() => {
                    this.deps.log('info', `${chat.umo}：进度提示「${line}」（第 ${chat.progressCount} 条）`);
                    this.notifySent({ umo: chat.umo, session: chat.session, text: line, chain, source: 'progress', time: Date.now() });
                })
                .catch(() => { });
        }
        catch { /* 进度提示失败不影响正常回复 */ }
    }

    onSessionEvent(session, event) {
        const umo = this.bySession.get(String(session.id));
        if (umo === undefined)
            return;
        const chat = this.chats.get(umo);
        if (chat === undefined)
            return;
        if (event.type === 'turn/start') {
            chat.lastText = '';
            chat.replyTarget = undefined;
            chat.running = true;
            // 本插件新增：记下开始时间、清进度计数，并挂一个心跳（单工具跑很久也不会哑着）
            chat.turnStarted = Date.now();
            chat.progressCount = 0;
            chat.progressLast = 0;
            if (chat.progressTimer !== undefined)
                clearInterval(chat.progressTimer);
            const heartbeat = Math.max(5, Number(this.deps.settings().progress?.heartbeatSeconds ?? PROGRESS_DEFAULT.heartbeatSeconds)) * 1000;
            chat.progressTimer = setInterval(() => {
                this.maybeProgress(chat, Date.now() - (chat.turnStarted ?? Date.now()), undefined);
            }, heartbeat);
            chat.progressTimer.unref?.();
        }
        else if (event.type === 'tool/call') {
            // 本插件新增：她开始用工具了，但还没说话——跑够久了就先应一声
            this.maybeProgress(chat, Date.now() - (chat.turnStarted ?? Date.now()), event.data?.name);
        }
        else if (event.type === 'user/message') {
            const source = event.data.source;
            // 本插件新增：只关联实际进入这一轮的 QQ 来信；主动唤醒不沿用上一轮的对象。
            if (source?.kind === 'plugin:napcat-bridge' || source?.kind === 'plugin:napcat-bridge-nudge')
                chat.replyTarget = source.replyTo;
            else if (source?.kind === 'plugin:napcat-bridge-wake')
                chat.replyTarget = undefined;
            // dsh 会追加 runtime-context 用户消息，不可因此擦掉真实来信对象。
        }
        else if (event.type === 'assistant/message') {
            const text = event.data.message.content
                .filter(b => b.type === 'text')
                .map(b => b.text ?? '')
                .join('');
            const clean = sanitizeOutbound(text);
            if (clean.trim() !== '')
                chat.lastText = clean;
        }
        else if (event.type === 'turn/end') {
            chat.running = false;
            if (chat.progressTimer !== undefined) {
                clearInterval(chat.progressTimer);
                chat.progressTimer = undefined;
            }
            const text = chat.lastText;
            chat.lastText = '';
            const replyTarget = chat.replyTarget;
            chat.replyTarget = undefined;
            const senders = [...chat.replySenders];
            chat.replySenders.clear();
            // 权限按这一轮真实发送者快照复查；不能借用上一次管理员发言的权限。
            const adminSender = () => senders.find(id => this.deps.settings().admins.includes(id));
            const canReply = () => this.canSend(chat.session, adminSender());
            if (!canReply())
                return;
            if (text.trim() === '') {
                // 本插件新增：这一轮正常结束，却一句话都没说出来（DeepSeek 偶尔把要回的话只写在思考里），提醒她一次。
                // 被 /stop 打断、出错的不提醒；同一条消息只提醒一次，免得来回打转。
                const reason = event.data?.reason?.kind;
                if (reason === 'completed' && !chat.nudged && this.deps.settings().nudgeOnEmpty) {
                    chat.nudged = true;
                    this.deps.log('info', umo + '：这一轮她什么都没说出来，提醒她把话说出来');
                    // 等这一轮在 dsh 里彻底收尾再发（turn/end 当下 agent 还算忙，这时 followup 不会开新一轮）
                    setTimeout(() => {
                        if (this.chats.get(umo) !== chat || !canReply())
                            return;
                        for (const id of senders)
                            chat.replySenders.add(id);
                        chat.handle.agent.followup(createUserMessage({ content: [{ type: 'text', text: nudgeText(this.deps.settings().silenceToken.trim()) }], source: { kind: 'plugin:napcat-bridge-nudge', ...(replyTarget ? { replyTo: replyTarget } : {}) } }));
                    }, NUDGE_DELAY_MS);
                }
                return;
            }
            // 本插件新增：她决定这次不说话（主动唤醒时）
            const token = this.deps.settings().silenceToken.trim();
            if (token !== '' && text.trim().startsWith(token)) {
                this.deps.log('info', umo + '：她决定不发');
                return;
            }
            // 本插件新增：分段发送（按设置拆成几条），每一条都像真人一样按打字速度等一会儿，群里守发言频率
            const settings = this.deps.settings();
            const isGroup = chat.info.type === 'group';
            const segments = segmentEnabled(settings.segment, { group: isGroup, adminPrivate: chat.info.adminPrivate })
                ? splitReply(text, settings.segment.maxSegments)
                : [text];
            // 拆成几段时，每段按自己的字数等，但每段有单独的上限（不然一行十几个字就等十秒，八行要等一分钟）
            // 本插件新增：文字转语音。先把每段标上用不用语音，语音马上开始合成（发的时候再等它），发送顺序不变
            const active = this.deps.tts !== undefined && ttsActive(settings.tts, { group: isGroup, adminPrivate: chat.info.adminPrivate });
            const pieces = planPieces(segments, settings.tts, active);
            const typing = pieces.length > 1 ? splitTyping(pieces.map(p => p.text), isGroup, settings.pace, settings.segment.maxSecondsPerSegment) : [undefined];
            let headerSent = false;
            pieces.forEach((piece, i) => {
                const speech = piece.voice ? this.deps.tts.speak(piece.text).catch((e) => {
                    this.deps.log('warn', umo + '：语音没合成出来，改发文字：' + errText(e));
                    return undefined;
                }) : undefined;
                const textChain = { chain: [Plain(piece.text)] };
                void this.pacer.run(umo, isGroup, piece.text, async () => {
                    const voice = await speech;
                    // 等打字、排队或合成语音后再读一次当前白名单，false 表示这条实际没有发出。
                    if (!canReply())
                        return false;
                    // 本插件新增：分段只装饰首条实际发送的文字；语音独立发，不混入 reply/at 段。
                    const sendText = async () => {
                        textChain.chain = this.groupReplyChain(piece.text, isGroup && !headerSent ? replyTarget : undefined, this.deps.settings()).chain;
                        await chat.send(textChain);
                        headerSent = true;
                    };
                    if (voice === undefined)
                        return sendText();
                    await chat.send({ chain: [make('Record', { file: 'base64://' + voice.audio.toString('base64') })] });
                    if (settings.tts.alsoText && canReply())
                        await sendText();
                }, typing[i], adminSender() !== undefined || (!isGroup && settings.admins.includes(chat.session.session_id))).then(result => {
                    if (result === 'dropped')
                        return;
                    this.notifySent({ umo, session: chat.session, text: piece.text, chain: textChain, source: 'reply', time: Date.now() });
                }, e => {
                    this.deps.log('error', '发送回复失败（' + umo + '）: ' + (e instanceof Error ? e.message : String(e)));
                });
            });
        }
    }
    /** 本插件新增：OneBot 引用在最前；对象来自来信元数据，不让模型猜 QQ 或消息 ID。 */
    groupReplyChain(text, target, settings) {
        const chain = [];
        if (target !== undefined) {
            if (settings.groupReply.quote && target.messageId)
                chain.push({ type: 'Reply', id: target.messageId });
            if (settings.groupReply.mention && target.userId)
                chain.push(At({ qq: target.userId }));
        }
        chain.push(Plain(text));
        return { chain };
    }
    /** 发 'napcat/sent'；监听器出错不影响发送。 */
    notifySent(payload) {
        try {
            this.deps.sent(payload);
        }
        catch (e) {
            this.deps.log('warn', 'napcat/sent 监听器出错: ' + errText(e));
        }
    }
    /** 已建立的会话（unified_msg_origin → dsh 会话 id）。 */
    sessions() {
        return [...this.chats.values()].map(c => ({ umo: c.umo, sessionId: String(c.handle.agent.session.id) }));
    }
    async dispose() {
        this.off();
        const handles = [...this.chats.values()].map(c => c.handle);
        this.chats.clear();
        this.bySession.clear();
        await Promise.allSettled(handles.map(h => h.dispose()));
    }
}
const NUDGE_DELAY_MS = 500;
/** 她只想没说时的提醒（不算对方说的话，记忆插件也不把它当一轮）。 */
export function nudgeText(silenceToken) {
    return '<system_reminder>你刚才这一轮只在心里想了，没有把要回的话说出来，对方什么都没收到。现在直接把要回复的话说出来'
        + (silenceToken ? '；如果决定不回，就只回「' + silenceToken + '」' : '') + '。不用解释为什么刚才没说。</system_reminder>';
}
export { MessageType, sessionToString };
