// 移植自 AstrBot（AGPL-3.0-or-later）：
//   astrbot/core/platform/sources/aiocqhttp/aiocqhttp_platform_adapter.py
//   astrbot/core/platform/sources/aiocqhttp/aiocqhttp_message_event.py
//   astrbot/core/platform/astrbot_message.py、message_type.py
// 只把消息的去向从 AstrBot 事件队列换成 onMessage 回调，转换和发送逻辑保持原样。
//
// v0.2.0 起在 AstrBot 的基础上做了这些改动（代码里标「改动」）：
// 时间用 QQ 的发送时间；消息按 message_id 去重；@ 名片、陌生人昵称、群名缓存；
// 补群名；小黄脸写成 [表情:名字]；商城表情和 NapCat 一样当普通图片（mface 段有地址时也转成图片）；
// 通知和请求补上名字并写成一句话（event_text）。
import { randomUUID } from 'node:crypto';
import { CQHttp } from './onebot/server.js';
import { eventFromPayload } from './onebot/event.js';
import { ActionFailed } from './onebot/errors.js';
import { TtlCache } from './cache.js';
import { describeNotice, describeRequest } from './notice.js';
import { QFACE } from './qface.js';
import { At, ComponentTypes, File, Plain, Poke, convertToBase64, make, toDict, toDictAsync, toFileUri, } from './components.js';
export var MessageType;
(function (MessageType) {
    MessageType["GROUP_MESSAGE"] = "GroupMessage";
    MessageType["FRIEND_MESSAGE"] = "FriendMessage";
    MessageType["OTHER_MESSAGE"] = "OtherMessage";
})(MessageType || (MessageType = {}));
export function sessionToString(s) {
    return s.platform_name + ':' + s.message_type + ':' + s.session_id;
}
export function groupId(abm) {
    return abm.group ? abm.group.group_id : '';
}
const nowSec = () => Math.floor(Date.now() / 1000);
/** 改动：用 QQ 给的发送时间，没有时才用收到的时间。 */
const eventTime = (event) => (Number.isInteger(event.time) && event.time > 0 ? event.time : nowSec());
const MINUTE = 60_000;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const errText = (e) => (e instanceof Error ? e.message : String(e));
/** AiocqhttpAdapter */
export class AiocqhttpAdapter {
    bot;
    getId;
    host;
    port;
    log;
    onMessage;
    /** 改动：get_group_member_info 结果缓存 10 分钟（key 群号:QQ） */
    memberCache = new TtlCache(10 * MINUTE, 5000);
    /** 改动：get_stranger_info 结果缓存 10 分钟 */
    strangerCache = new TtlCache(10 * MINUTE, 5000);
    /** 改动：群名缓存 30 分钟 */
    groupNameCache = new TtlCache(30 * MINUTE, 1000);
    /** 改动：收过的消息（去重用，key self_id:message_id），保留 10 分钟 */
    seen = new TtlCache(10 * MINUTE, 20000);
    /** 改动：最近消息的发送者和文字，撤回通知时用来说明撤回了什么，保留 30 分钟 */
    recent = new TtlCache(30 * MINUTE, 5000);
    constructor(options) {
        const id = options.id;
        this.getId = typeof id === 'function' ? id : () => id;
        this.host = options.ws_reverse_host;
        this.port = options.ws_reverse_port;
        this.log = options.log;
        this.onMessage = options.onMessage;
        this.bot = new CQHttp({ accessToken: options.ws_reverse_token, apiTimeoutSec: 180, log: options.log });
        // 本插件新增：共用事件转换流程，保留各事件的订阅顺序和原有错误日志。
        for (const [subscribe, kind] of [
            [this.bot.onRequest(), 'request'], [this.bot.onNotice(), 'notice'],
            [this.bot.onMessage('group'), 'group'], [this.bot.onMessage('private'), 'private'],
        ]) {
            subscribe(async (event) => {
                try {
                    const abm = await this.convertMessage(event);
                    if (abm)
                        await this.handleMsg(abm);
                }
                catch (e) {
                    this.log('error', 'Handle ' + kind + ' message failed: ' + errText(e));
                }
            });
        }
        this.bot.onWebsocketConnection(() => {
            this.log('info', 'aiocqhttp(OneBot v11) 适配器已连接。');
        });
    }
    /** send_by_session */
    async sendBySession(session, messageChain) {
        const isGroup = session.message_type === MessageType.GROUP_MESSAGE;
        const sessionId = isGroup ? session.session_id.split('_').at(-1) : session.session_id;
        await AiocqhttpMessageEvent.sendMessage(this.bot, messageChain, null, isGroup, sessionId, this.log);
    }
    /** convert_message */
    async convertMessage(event) {
        this.log('debug', '[aiocqhttp] RawMessage ' + JSON.stringify(event));
        let abm = null;
        if (event.post_type === 'message') {
            // 改动：同一条消息只处理一次（NapCat 配了两个连接、重启重报时会重复）
            const key = String(event.self_id) + ':' + String(event.message_id);
            if (event.message_id !== undefined && this.seen.has(key)) {
                this.log('debug', '重复消息已忽略: ' + key);
                return null;
            }
            if (event.message_id !== undefined)
                this.seen.set(key, true);
            abm = await this.convertHandleMessageEvent(event);
            if (abm.sender.user_id === '2854196310') {
                // 屏蔽 QQ 管家的消息
                return null;
            }
        }
        else if (event.post_type === 'notice') {
            abm = await this.convertHandleNoticeEvent(event);
        }
        else if (event.post_type === 'request') {
            abm = await this.convertHandleRequestEvent(event);
        }
        return abm;
    }
    /** _convert_handle_request_event：OneBot V11 请求类事件 */
    async convertHandleRequestEvent(event) {
        // 改动：sender 昵称查真实昵称（AstrBot 直接填 QQ 号）
        const userName = await this.displayName(event, event.user_id);
        const sender = { user_id: String(event.user_id), nickname: userName || String(event.user_id) };
        const isGroup = Boolean(event.group_id);
        return {
            self_id: String(event.self_id),
            sender,
            type: isGroup ? MessageType.GROUP_MESSAGE : MessageType.FRIEND_MESSAGE,
            group: isGroup ? { group_id: String(event.group_id), group_name: await this.groupName(event) } : null,
            session_id: isGroup ? String(event.group_id) : sender.user_id,
            message_str: '',
            message: [],
            timestamp: eventTime(event),
            message_id: randomUUID().replace(/-/g, ''),
            raw_message: event,
            event_text: describeRequest(event, { user: userName, operator: '', target: '' }),
        };
    }
    /** _convert_handle_notice_event：OneBot V11 通知类事件 */
    async convertHandleNoticeEvent(event) {
        // 改动：sender 昵称查真实昵称（AstrBot 直接填 QQ 号），并写一句中文描述
        const userName = await this.displayName(event, event.user_id);
        const operatorName = event.operator_id !== undefined ? await this.displayName(event, event.operator_id) : '';
        const targetName = event.target_id !== undefined ? await this.displayName(event, event.target_id) : '';
        const recalled = event.message_id !== undefined ? this.recent.get(String(event.self_id) + ':' + String(event.message_id)) : undefined;
        const sender = { user_id: String(event.user_id), nickname: userName || String(event.user_id) };
        const isGroup = Boolean(event.group_id);
        const abm = {
            self_id: String(event.self_id),
            sender,
            type: isGroup ? MessageType.GROUP_MESSAGE : MessageType.FRIEND_MESSAGE,
            group: isGroup ? { group_id: String(event.group_id), group_name: await this.groupName(event) } : null,
            session_id: isGroup ? String(event.group_id) : sender.user_id,
            message_str: '',
            message: [],
            raw_message: event,
            timestamp: eventTime(event),
            message_id: randomUUID().replace(/-/g, ''),
            event_text: describeNotice(event, { user: userName, operator: operatorName, target: targetName, recalled }, String(event.self_id)),
        };
        if ('sub_type' in event) {
            if (event.sub_type === 'poke' && 'target_id' in event) {
                abm.message.push(Poke({ id: String(event.target_id) }));
            }
        }
        return abm;
    }
    /**
     * _convert_handle_message_event：OneBot V11 消息类事件
     * @param getReply 是否获取回复消息。这个参数是为了防止多个回复嵌套。
     */
    async convertHandleMessageEvent(event, getReply = true) {
        if (event.sender === undefined || event.sender === null)
            throw new Error('AssertionError: event.sender is None');
        const abm = {
            self_id: String(event.self_id),
            sender: {
                user_id: String(event.sender.user_id),
                nickname: event.sender.card || (event.sender.nickname ?? 'N/A'),
            },
            type: MessageType.OTHER_MESSAGE,
            group: null,
            session_id: '',
            message_id: '',
            message: [],
            message_str: '',
            raw_message: event,
            timestamp: nowSec(),
        };
        if (event.message_type === 'group') {
            abm.type = MessageType.GROUP_MESSAGE;
            // 改动：NapCat 常常不带 group_name，查一次缓存起来
            abm.group = { group_id: String(event.group_id), group_name: getReply ? await this.groupName(event) : event.group_name };
        }
        else if (event.message_type === 'private') {
            abm.type = MessageType.FRIEND_MESSAGE;
        }
        abm.session_id = abm.type === MessageType.GROUP_MESSAGE ? String(event.group_id) : abm.sender.user_id;
        abm.message_id = String(event.message_id);
        let messageStr = '';
        if (!Array.isArray(event.message)) {
            const err = 'aiocqhttp: 无法识别的消息类型: ' + String(event.message) + '，此条消息将被忽略。如果您在使用 go-cqhttp，请将其配置文件中的 message.post-format 更改为 array。';
            this.log('error', err);
            try {
                await this.bot.send(event, err);
            }
            catch (e) {
                this.log('error', '回复消息失败: ' + errText(e));
            }
            throw new Error(err);
        }
        // 按消息段类型适配（itertools.groupby：相邻同类型分为一组）
        const routingParams = event.self_id ? { self_id: event.self_id } : {};
        for (const [t, mGroup] of groupBy(event.message)) {
            if (t === 'text') {
                const currentText = mGroup.map(m => m.data.text).join('').trim();
                if (!currentText)
                    continue; // 如果文本段为空，则跳过
                messageStr += currentText;
                abm.message.push(ComponentTypes[t]({ text: currentText }));
            }
            else if (t === 'file') {
                for (const m of mGroup) {
                    if (m.data.url && String(m.data.url).startsWith('http')) {
                        // Lagrange
                        this.log('info', 'guessing lagrange');
                        const fileName = m.data.file_name || m.data.name || m.data.file || 'file';
                        abm.message.push(File({ name: fileName, url: m.data.url }));
                    }
                    else {
                        try {
                            // Napcat
                            let ret = null;
                            if (abm.type === MessageType.GROUP_MESSAGE) {
                                ret = await this.bot.callAction('get_group_file_url', { file_id: m.data.file_id, group_id: event.group_id, ...routingParams });
                            }
                            else if (abm.type === MessageType.FRIEND_MESSAGE) {
                                ret = await this.bot.callAction('get_private_file_url', { file_id: m.data.file_id, ...routingParams });
                            }
                            if (ret && typeof ret === 'object' && 'url' in ret) {
                                const fileUrl = ret.url;
                                // 优先从 API 返回值获取文件名，其次从原始消息数据获取
                                const fileName = ret.file_name || ret.name || m.data.file || m.data.file_name || '';
                                abm.message.push(File({ name: fileName, url: fileUrl }));
                            }
                            else {
                                this.log('error', '获取文件失败: ' + JSON.stringify(ret));
                            }
                        }
                        catch (e) {
                            this.log('error', '获取文件失败: ' + errText(e) + '，此消息段将被忽略。');
                        }
                    }
                }
            }
            else if (t === 'reply') {
                for (const m of mGroup) {
                    if (!getReply) {
                        abm.message.push(ComponentTypes[t](m.data));
                    }
                    else {
                        try {
                            const replyEventData = await this.bot.callAction('get_msg', { message_id: parseInt(String(m.data.id), 10), ...routingParams });
                            // 添加必要的 post_type 字段，防止 Event.from_payload 报错
                            replyEventData.post_type = 'message';
                            const newEvent = eventFromPayload(replyEventData);
                            if (!newEvent) {
                                this.log('error', '无法从回复消息数据构造 Event 对象: ' + JSON.stringify(replyEventData));
                                continue;
                            }
                            const abmReply = await this.convertHandleMessageEvent(newEvent, false);
                            abm.message.push(make('Reply', {
                                id: abmReply.message_id,
                                chain: abmReply.message,
                                sender_id: abmReply.sender.user_id,
                                sender_nickname: abmReply.sender.nickname,
                                time: abmReply.timestamp,
                                message_str: abmReply.message_str,
                                text: abmReply.message_str, // for compatibility
                                qq: abmReply.sender.user_id, // for compatibility
                            }));
                        }
                        catch (e) {
                            this.log('error', '获取引用消息失败: ' + errText(e) + '。');
                            abm.message.push(ComponentTypes[t](m.data));
                        }
                    }
                }
            }
            else if (t === 'at') {
                let firstAtSelfProcessed = false;
                const atParts = [];
                for (const m of mGroup) {
                    try {
                        if (m.data.qq === 'all') {
                            abm.message.push(At({ qq: 'all', name: '全体成员' }));
                            continue;
                        }
                        // 改动：两次查询都走缓存
                        let atInfo = await this.memberInfo(event.group_id, m.data.qq, routingParams);
                        if (atInfo) {
                            let nickname = atInfo.card ?? '';
                            if (nickname === '') {
                                atInfo = await this.strangerInfo(m.data.qq, routingParams);
                                nickname = atInfo?.nick || atInfo?.nickname || '';
                            }
                            const isAtSelf = String(m.data.qq) === abm.self_id || String(m.data.qq) === 'all';
                            abm.message.push(At({ qq: m.data.qq, name: nickname }));
                            if (isAtSelf && !firstAtSelfProcessed) {
                                // 第一个@是机器人，不添加到message_str
                                firstAtSelfProcessed = true;
                            }
                            else {
                                // 非第一个@机器人或@其他用户，添加到message_str
                                atParts.push(' @' + nickname + '(' + m.data.qq + ') ');
                            }
                        }
                        else {
                            abm.message.push(At({ qq: String(m.data.qq), name: '' }));
                        }
                    }
                    catch (e) {
                        this.log('error', '获取 @ 用户信息失败: ' + errText(e) + '，此消息段将被忽略。');
                    }
                }
                messageStr += atParts.join('');
            }
            else if (t === 'mface') {
                // 改动：AstrBot 直接丢掉。NapCat 把商城表情当普通 image 段发；其他实现发来的 mface 段有图片地址时，
                // 也和 NapCat 一样当成普通图片
                for (const m of mGroup) {
                    if (m.data.url)
                        abm.message.push(make('Image', { file: m.data.url, url: m.data.url }));
                }
            }
            else if (t === 'face') {
                // 改动：小黄脸写进文字 [表情:名字]
                for (const m of mGroup) {
                    try {
                        abm.message.push(ComponentTypes[t](m.data));
                    }
                    catch (e) {
                        this.log('error', '消息段解析失败: type=' + t + ', data=' + JSON.stringify(m.data) + '. ' + errText(e));
                    }
                    const name = QFACE[String(m.data.id)];
                    messageStr += '[表情:' + (name ?? String(m.data.id)) + ']';
                }
            }
            else if (t === 'markdown') {
                for (const m of mGroup) {
                    const text = m.data.markdown || m.data.content || '';
                    abm.message.push(Plain(text));
                    messageStr += text;
                }
            }
            else {
                for (const m of mGroup) {
                    try {
                        if (!(t in ComponentTypes)) {
                            this.log('warn', '不支持的消息段类型，已忽略: ' + t + ', data=' + JSON.stringify(m.data));
                            continue;
                        }
                        abm.message.push(ComponentTypes[t](m.data));
                    }
                    catch (e) {
                        this.log('error', '消息段解析失败: type=' + t + ', data=' + JSON.stringify(m.data) + '. ' + errText(e));
                        continue;
                    }
                }
            }
        }
        abm.timestamp = eventTime(event);
        abm.message_str = messageStr;
        abm.raw_message = event;
        if (getReply) {
            const preview = messageStr || (abm.message.some(c => c.type === 'Image') ? '[图片]' : '');
            this.recent.set(abm.self_id + ':' + abm.message_id, abm.sender.nickname + '(' + abm.sender.user_id + ')：' + preview);
        }
        return abm;
    }
    /** 改动：带缓存的 get_group_member_info（失败时返回 null，不缓存）。 */
    async memberInfo(groupIdValue, userId, routingParams) {
        const key = String(groupIdValue) + ':' + String(userId);
        return this.memberCache.getOrLoad(key, () => this.bot.callAction('get_group_member_info', {
            group_id: groupIdValue,
            user_id: parseInt(String(userId), 10),
            no_cache: false,
            ...routingParams,
        }));
    }
    /** 改动：带缓存的 get_stranger_info。 */
    async strangerInfo(userId, routingParams) {
        return this.strangerCache.getOrLoad(String(userId), () => this.bot.callAction('get_stranger_info', {
            user_id: parseInt(String(userId), 10),
            no_cache: false,
            ...routingParams,
        }));
    }
    /** 改动：群名（事件里有就用并记下，没有就查 get_group_info，失败返回 undefined）。 */
    async groupName(event) {
        if (!event.group_id)
            return undefined;
        const key = String(event.group_id);
        if (event.group_name) {
            this.groupNameCache.set(key, String(event.group_name));
            return String(event.group_name);
        }
        try {
            const routingParams = event.self_id ? { self_id: event.self_id } : {};
            return await this.groupNameCache.getOrLoad(key, async () => {
                const info = await this.bot.callAction('get_group_info', { group_id: event.group_id, ...routingParams });
                return String(info?.group_name ?? '');
            }) || undefined;
        }
        catch (e) {
            this.log('debug', '获取群名失败 ' + key + ': ' + errText(e));
            return undefined;
        }
    }
    /** 改动：某个 QQ 号的显示名：群里用名片/昵称，私聊用陌生人昵称；查不到返回空。 */
    async displayName(event, userId) {
        if (userId === undefined || userId === null || String(userId) === '0')
            return '';
        const routingParams = event.self_id ? { self_id: event.self_id } : {};
        try {
            if (event.group_id) {
                const info = await this.memberInfo(event.group_id, userId, routingParams);
                if (info && (info.card || info.nickname))
                    return String(info.card || info.nickname);
            }
            const info = await this.strangerInfo(userId, routingParams);
            return String(info?.nick || info?.nickname || '');
        }
        catch {
            return '';
        }
    }
    get id() {
        return this.getId();
    }
    /** 改动：设置页改了监听地址/端口时，用新的地址重启（不影响已建立的 dsh 会话）。 */
    async restart(host, port) {
        await this.bot.close();
        this.host = host;
        this.port = port;
        await this.run();
    }
    /** run */
    async run() {
        if (!this.host || !this.port) {
            this.log('warn', 'aiocqhttp: 未配置 ws_reverse_host 或 ws_reverse_port，将使用默认值：http://0.0.0.0:6199');
            this.host = '0.0.0.0';
            this.port = 6199;
        }
        await this.bot.run(this.host, this.port);
    }
    /** terminate */
    async terminate() {
        await this.bot.close();
        this.log('info', 'aiocqhttp 适配器已被关闭');
    }
    /** create_event */
    createEvent(message) {
        return new AiocqhttpMessageEvent(message, this.id, this.bot, this.log);
    }
    /** handle_msg：AstrBot 在这里 commit_event 进事件队列。 */
    async handleMsg(message) {
        await this.onMessage(message, this.createEvent(message));
    }
}
/** itertools.groupby(seq, key=lambda x: x["type"]) */
function groupBy(items) {
    const out = [];
    for (const item of items) {
        const last = out.at(-1);
        if (last !== undefined && last[0] === item.type)
            last[1].push(item);
        else
            out.push([item.type, [item]]);
    }
    return out;
}
/** AiocqhttpMessageEvent */
export class AiocqhttpMessageEvent {
    message_obj;
    message_str;
    session;
    bot;
    log;
    constructor(message, platformId, bot, log) {
        this.message_obj = message;
        this.message_str = message.message_str;
        this.session = { platform_name: platformId, message_type: message.type, session_id: message.session_id };
        this.bot = bot;
        this.log = log;
    }
    get unified_msg_origin() {
        return sessionToString(this.session);
    }
    getGroupId() {
        return groupId(this.message_obj);
    }
    getSenderId() {
        return this.message_obj.sender.user_id;
    }
    getSelfId() {
        return this.message_obj.self_id;
    }
    isPrivateChat() {
        return this.message_obj.type === MessageType.FRIEND_MESSAGE;
    }
    /** _from_segment_to_dict：修复部分字段 */
    static async fromSegmentToDict(segment) {
        if (segment.type === 'Image' || segment.type === 'Record') {
            const bs64 = await convertToBase64(segment);
            return { type: segment.type.toLowerCase(), data: { file: 'base64://' + bs64 } };
        }
        if (segment.type === 'File') {
            const d = await toDictAsync(segment);
            const fileVal = d.data?.file ?? '';
            if (fileVal) {
                try {
                    d.data.file = toFileUri(fileVal);
                }
                catch {
                    // 如果不是合法路径，则跳过转换
                }
            }
            return d;
        }
        if (segment.type === 'Video')
            return toDictAsync(segment);
        return toDict(segment);
    }
    /** _parse_onebot_json：解析成 OneBot json 格式 */
    static async parseOnebotJson(messageChain) {
        const ret = [];
        for (const segment of messageChain.chain) {
            if (segment.type === 'Plain' && !String(segment.text).trim())
                continue;
            ret.push(await AiocqhttpMessageEvent.fromSegmentToDict(segment));
            // At 组件后保留空格，避免与后续文本粘连。
            if (segment.type === 'At')
                ret.push({ type: 'text', data: { text: ' ' } });
        }
        return ret;
    }
    /** _dispatch_send */
    static async dispatchSend(bot, event, isGroup, sessionId, messages) {
        // session_id 必须是纯数字字符串
        const sessionIdInt = sessionId && /^\d+$/.test(sessionId) ? parseInt(sessionId, 10) : null;
        const routingParams = {};
        if (event && event.self_id)
            routingParams.self_id = event.self_id;
        if (isGroup && sessionIdInt !== null) {
            await bot.sendGroupMsg({ group_id: sessionIdInt, message: messages, ...routingParams });
        }
        else if (!isGroup && sessionIdInt !== null) {
            await bot.sendPrivateMsg({ user_id: sessionIdInt, message: messages, ...routingParams });
        }
        else if (event) {
            // 最后兜底
            await bot.send(event, messages);
        }
        else {
            throw new Error('无法发送消息：缺少有效的数字 session_id(' + sessionId + ') 或 event(' + event + ')');
        }
    }
    /** send_message：发送消息至 QQ 协议端 */
    static async sendMessage(bot, messageChain, event, isGroup, sessionId, _log) {
        // 转发消息、文件消息不能和普通消息混在一起发送
        const sendOneByOne = messageChain.chain.some(seg => seg.type === 'Node' || seg.type === 'Nodes' || seg.type === 'File');
        if (!sendOneByOne) {
            const ret = await AiocqhttpMessageEvent.parseOnebotJson(messageChain);
            if (ret.length === 0)
                return;
            await AiocqhttpMessageEvent.dispatchSend(bot, event, isGroup, sessionId, ret);
            return;
        }
        for (let seg of messageChain.chain) {
            if (seg.type === 'Node' || seg.type === 'Nodes') {
                // 合并转发消息
                if (seg.type === 'Node')
                    seg = make('Nodes', { nodes: [seg] });
                const payload = await toDictAsync(seg);
                if (event && event.self_id)
                    payload.self_id = event.self_id;
                if (isGroup) {
                    payload.group_id = sessionId;
                    await bot.callAction('send_group_forward_msg', payload);
                }
                else {
                    payload.user_id = sessionId;
                    await bot.callAction('send_private_forward_msg', payload);
                }
            }
            else if (seg.type === 'File') {
                const d = await AiocqhttpMessageEvent.fromSegmentToDict(seg);
                await AiocqhttpMessageEvent.dispatchSend(bot, event, isGroup, sessionId, [d]);
            }
            else {
                const messages = await AiocqhttpMessageEvent.parseOnebotJson({ chain: [seg] });
                if (messages.length === 0)
                    continue;
                await AiocqhttpMessageEvent.dispatchSend(bot, event, isGroup, sessionId, messages);
                await sleep(500);
            }
        }
    }
    /** send */
    async send(message) {
        const event = this.message_obj.raw_message ?? null;
        const isGroup = Boolean(this.getGroupId());
        const sessionId = isGroup ? this.getGroupId() : this.getSenderId();
        await AiocqhttpMessageEvent.sendMessage(this.bot, message, event, isGroup, sessionId, this.log);
    }
    /** send_streaming（use_fallback=False 时攒成一条发；True 时按句子分段发）。 */
    async sendStreaming(generator, useFallback = false) {
        if (!useFallback) {
            let buffer = null;
            for await (const chain of generator) {
                if (!buffer)
                    buffer = { chain: [...chain.chain] };
                else
                    buffer.chain.push(...chain.chain);
            }
            if (!buffer)
                return;
            await this.send(squashPlain(buffer));
            return;
        }
        let buffer = '';
        const pattern = /[^。？！~…]+[。？！~…]+/g;
        for await (const chain of generator) {
            for (const comp of chain.chain) {
                if (comp.type === 'Plain') {
                    buffer += comp.text;
                    if ([...'。？！~…'].some(p => buffer.includes(p)))
                        buffer = await this.processBuffer(buffer, pattern);
                }
                else {
                    await this.send({ chain: [comp] });
                    await sleep(1500); // 限速
                }
            }
        }
        buffer = buffer.trim();
        if (buffer)
            await this.send({ chain: [Plain(buffer)] });
    }
    /** AstrMessageEvent.process_buffer：把完整的句子逐条发出，返回剩余部分。 */
    async processBuffer(buffer, pattern) {
        while (true) {
            pattern.lastIndex = 0;
            const match = pattern.exec(buffer);
            if (!match)
                break;
            const matched = match[0].trim();
            if (matched) {
                await this.send({ chain: [Plain(matched)] });
                await sleep(1500); // 限速
            }
            buffer = buffer.slice(match.index + match[0].length);
        }
        return buffer;
    }
    /** get_group：取群信息，失败时保留已有数据。 */
    async getGroup(groupIdArg) {
        const resolved = groupIdArg ?? this.getGroupId();
        if (!resolved)
            return null;
        const resolvedGroupId = String(resolved);
        const apiGroupId = /^\d+$/.test(resolvedGroupId) ? parseInt(resolvedGroupId, 10) : resolvedGroupId;
        const current = this.message_obj.group;
        const group = current && current.group_id === resolvedGroupId ? current : { group_id: resolvedGroupId };
        const routingParams = {};
        if (this.message_obj.self_id)
            routingParams.self_id = this.message_obj.self_id;
        try {
            const info = await this.bot.callAction('get_group_info', { group_id: apiGroupId, ...routingParams });
            if (info && typeof info === 'object') {
                group.group_name = info.group_name || group.group_name;
                const memberCount = info.member_count;
                if (memberCount !== undefined && memberCount !== null) {
                    const n = parseInt(String(memberCount), 10);
                    if (Number.isNaN(n))
                        this.log('warn', '[aiocqhttp] Invalid member_count for group ' + resolvedGroupId);
                    else
                        group.member_count = n;
                }
            }
        }
        catch (e) {
            this.log('warn', '[aiocqhttp] Failed to get group information for ' + resolvedGroupId + ': ' + errText(e));
        }
        let members;
        try {
            members = await this.bot.callAction('get_group_member_list', { group_id: apiGroupId, ...routingParams });
        }
        catch (e) {
            this.log('warn', '[aiocqhttp] Failed to get members for group ' + resolvedGroupId + ': ' + errText(e));
            return group;
        }
        if (!Array.isArray(members))
            return group;
        let ownerId = null;
        const adminIds = [];
        for (const member of members) {
            if (!member || typeof member !== 'object' || member.user_id === undefined || member.user_id === null)
                continue;
            if (member.role === 'owner')
                ownerId = String(member.user_id);
            if (member.role === 'admin')
                adminIds.push(String(member.user_id));
        }
        group.group_admins = adminIds;
        group.group_owner = ownerId;
        group.members = members
            .filter(m => m && typeof m === 'object' && m.user_id !== undefined && m.user_id !== null)
            .map(m => ({ user_id: String(m.user_id), nickname: m.nickname || m.card }));
        if (group.member_count === undefined || group.member_count === null)
            group.member_count = group.members.length;
        return group;
    }
}
/** MessageChain.squash_plain：合并所有 Plain 为一个，放在第一个 Plain 的位置。 */
function squashPlain(chain) {
    const texts = [];
    const out = [];
    let first;
    for (const comp of chain.chain) {
        if (comp.type === 'Plain') {
            texts.push(comp.text);
            if (first === undefined) {
                out.push(comp);
                first = comp;
            }
        }
        else {
            out.push(comp);
        }
    }
    if (first !== undefined)
        first.text = texts.join('');
    return { chain: out };
}
export { ActionFailed };
