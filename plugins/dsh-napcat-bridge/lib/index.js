// dsh 插件入口：照 AstrBot 的 aiocqhttp（OneBot v11）适配器，把 NapCat 接到 dsh。
import z from '@deepseek-ai/schemastery';
import { AiocqhttpAdapter, MessageType, sessionToString } from './adapter.js';
import { Bridge, legacyWhitelistFor } from './bridge.js';
import { listModels } from './models.js';
import { findFfmpeg, installFfmpeg, platformTag } from './ffmpeg.js';
import { Media } from './media.js';
import { SessionStore, defaultDataDir } from './store.js';
import { testStt } from './stt.js';
import { sendMail, sendPush } from './alert.js';
import { Watchdog } from './watch.js';
import { Tts, testSpeak } from './tts.js';
import { join } from 'node:path';
export * from './adapter.js';
export * from './components.js';
export { ActionFailed, ApiNotAvailable, NetworkError } from './onebot/errors.js';
// 每项都标 .volatile()：dsh 的设置服务只对这种字段提供在线编辑，保存后插件不重启、直接读到新值。
export const Config = z.object({
    id: z.string().default('napcat').volatile().description('平台 ID，会话标识 unified_msg_origin 的第一段（AstrBot 的机器人 ID）'),
    ws_reverse_host: z.string().default('0.0.0.0').volatile().description('反向 WebSocket 监听地址（AstrBot 默认 0.0.0.0）'),
    ws_reverse_port: z.natural().max(65535).default(6199).volatile().description('反向 WebSocket 端口（AstrBot 默认 6199）'),
    ws_reverse_token: z.string().role('secret').volatile().description('反向 WebSocket Token，与 NapCat 里填的一致；留空则不校验'),
    wake_prefix: z.array(z.string()).default(['/']).volatile().description('唤醒前缀（AstrBot 默认 ["/"]）'),
    wakeKeywords: z.array(z.string()).default(['大肥鱼', '肥鱼']).volatile().description('唤醒词：群消息正文里出现这些词（不用 @）也唤醒她；不匹配 @对象昵称'),
    friend_message_needs_wake_prefix: z.boolean().default(false).volatile().description('私聊是否也需要唤醒前缀'),
    ignore_bot_self_message: z.boolean().default(false).volatile().description('是否忽略机器人自己发出的消息'),
    workspacePath: z.string().default('').volatile().description('QQ 会话的工作目录（绝对路径）；留空用 dsh 进程当前目录'),
    agentPreset: z.string().default('').volatile().description('QQ 会话使用的 agent 预设 id；留空用默认预设'),
    identifier: z.boolean().default(true).volatile().description('群消息交给模型时前面加 [昵称(QQ号)]'),
    imageToModel: z.boolean().default(true).volatile().description('图片（含商城表情、引用消息里的图片）作为附件交给模型；模型要支持看图（如 deepseek-flash）'),
    maxImages: z.natural().default(0).volatile().description('一条消息最多交给模型几张图片；0 = 不限'),
    // 访问控制（AstrBot platform_settings / admins_id）
    admins: z.array(z.string()).default([]).volatile().description('管理员 QQ 号'),
    whitelistEnabled: z.boolean().default(true).volatile().description('启用群聊和普通私聊白名单；管理员始终不受限制，空名单禁止对应普通会话'),
    whitelist: z.array(z.string()).default([]).volatile().hidden().description('旧混合名单，仅用于首次迁移'),
    groupWhitelist: z.array(z.string()).volatile().description('群聊白名单：群号或完整群会话标识；管理员发言始终豁免'),
    privateWhitelist: z.array(z.string()).volatile().description('其他人私聊白名单：QQ 号或完整私聊标识；管理员不用添加'),
    whitelistIgnoreAdminOnGroup: z.boolean().default(false).volatile().hidden().description('旧配置兼容项，已忽略：管理员默认拥有最高权限'),
    whitelistIgnoreAdminOnFriend: z.boolean().default(false).volatile().hidden().description('旧配置兼容项，已忽略：管理员默认拥有最高权限'),
    whitelistLog: z.boolean().default(true).volatile().description('不在白名单时记日志'),
    rateLimitCount: z.natural().default(30).volatile().description('频率限制：时间窗口内最多处理几条（0 = 不限）'),
    rateLimitSeconds: z.natural().min(1).default(60).volatile().description('频率限制：时间窗口（秒）'),
    rateLimitStrategy: z.union(['stall', 'discard']).default('stall').volatile().description('超出后：stall 排队等，discard 丢弃'),
    // 唤醒
    emptyMentionWaiting: z.boolean().default(true).volatile().description('只 @ 她不说话时，等这个人 60 秒内的下一条'),
    emptyMentionNeedReply: z.boolean().default(true).volatile().description('只 @ 她时先让她问一句'),
    uniqueSession: z.boolean().default(false).volatile().description('群里每人单独一个会话'),
    // 交给模型的内容
    datetimeReminder: z.boolean().default(true).volatile().description('告诉模型当前时间'),
    timezone: z.string().default('Asia/Shanghai').volatile().description('时区'),
    groupNameDisplay: z.boolean().default(true).volatile().description('告诉模型群名'),
    markAdmin: z.boolean().default(true).volatile().description('发送者是管理员时告诉模型'),
    markWake: z.boolean().default(true).volatile().description('群里被 @ 或被引用叫醒时，告诉模型「这条是在叫你」和她自己的 QQ 号、群名片'),
    // 指令
    commandsEnabled: z.boolean().default(true).volatile().description('启用 QQ 里的指令（/help /sid /new /reset /stop）'),
    noPermissionReply: z.boolean().default(true).volatile().description('没有权限用指令时回一句'),
    // 按聊天类型选预设和模型（只影响新建的会话）
    privateAgentPreset: z.string().default('').volatile().description('私聊用的预设'),
    groupAgentPreset: z.string().default('').volatile().description('群聊用的预设'),
    adminPrivateAgentPreset: z.string().default('').volatile().description('管理员私聊用的预设'),
    privateModel: z.string().default('deepseek-official/deepseek-flash').volatile().description('私聊用的模型（提供方/模型）'),
    groupModel: z.string().default('deepseek-official/deepseek-flash').volatile().description('群聊用的模型（提供方/模型）'),
    adminPrivateModel: z.string().default('deepseek-official/deepseek-flash').volatile().description('管理员私聊用的模型（提供方/模型）'),
    adminPrivateReasoning: z.string().default('high').volatile().description('管理员私聊的思考等级（按模型支持的来；DeepSeek：off 不思考，low / high / max 越来越深）'),
    privateReasoning: z.string().default('low').volatile().description('其他私聊的思考等级'),
    groupReasoning: z.string().default('low').volatile().description('群聊的思考等级'),
    // 语音转文字
    sttMode: z.union(['off', 'command', 'openai']).default('off').volatile().description('语音转文字：off 关闭，command 本机命令，openai 兼容接口'),
    sttCommand: z.string().default('').volatile().description('本机命令，{file} 换成语音文件路径，输出就是文字'),
    sttApiUrl: z.string().default('').volatile().description('OpenAI 兼容接口地址（到 /v1 为止）'),
    sttApiKey: z.string().role('secret').volatile().description('接口 Key'),
    sttModel: z.string().default('').volatile().description('转写模型名'),
    // 视频（本插件新增）：用 ffmpeg 截几张画面当图片交给模型
    videoFrames: z.boolean().default(true).volatile().description('视频抽帧：截几张画面交给模型（找不到 ffmpeg 时自动当作关闭）'),
    videoMaxFrames: z.natural().min(1).default(4).volatile().description('每个视频最多截几张'),
    videoSecondsPerFrame: z.natural().min(1).default(5).volatile().description('短视频少截：每多少秒最多一张'),
    videoMaxEdge: z.natural().min(64).default(1024).volatile().description('截图最长边（像素）'),
    videoMaxMB: z.natural().min(1).default(100).volatile().description('超过这么大（MB）只截封面'),
    videoMaxMinutes: z.natural().min(1).default(10).volatile().description('超过这么长（分钟）只截封面'),
    videoTimeoutSeconds: z.natural().min(5).default(30).volatile().description('处理一个视频最多用几秒，超时只写 [视频]'),
    ffmpegPath: z.string().default('').volatile().description('ffmpeg 位置；留空先找插件自己装的，再找系统里的'),
    silenceToken: z.string().default('[不发]').volatile().description('她的回复以这个开头时不发出去（主动唤醒时她决定不说话用）'),
    nudgeOnEmpty: z.boolean().default(true).volatile().description('她一轮结束时什么都没说出来（话只写在了思考里），自动提醒她一次把话说出来'),
    typingPrivate: z.boolean().default(true).volatile().description('私聊里按打字速度等一会儿再发'),
    typingGroup: z.boolean().default(true).volatile().description('群里按打字速度等一会儿再发'),
    typingCharsPerMinute: z.natural().default(100).volatile().description('打字速度：每分钟几个字（0 = 不等）'),
    typingMinSeconds: z.natural().default(1).volatile().description('打字最少等几秒'),
    typingMaxSeconds: z.natural().default(10).volatile().description('打字最多等几秒'),
    groupMinGapSeconds: z.natural().default(5).volatile().description('同一个群她两条消息之间至少隔几秒（0 = 不限）'),
    groupMaxPerWindow: z.natural().default(5).volatile().description('同一个群一段时间里她最多发几条（0 = 不限）'),
    groupWindowSeconds: z.natural().min(1).default(60).volatile().description('上面那段时间是几秒'),
    sendMaxWaitSeconds: z.natural().default(120).volatile().description('为了守发言频率最多等几秒，超过就不发了'),
    // 本插件新增：群聊回复对象；两个开关默认都关闭。
    groupReplyMention: z.boolean().default(false).volatile().description('群聊回复时 @ 触发本轮的消息发送者；分段只加在首条文字'),
    groupReplyQuote: z.boolean().default(false).volatile().description('群聊回复时引用触发本轮的原消息；分段只加在首条文字'),
    segmentAdminPrivate: z.boolean().default(true).volatile().description('分段发送：管理员私聊里把一次回复按行拆成几条发'),
    segmentPrivate: z.boolean().default(false).volatile().description('分段发送：其他私聊'),
    segmentGroup: z.boolean().default(false).volatile().description('分段发送：群聊'),
    segmentMax: z.natural().min(1).default(10).volatile().description('分段发送：一次回复最多拆成几条（多出来的并进最后一条）'),
    segmentMaxSeconds: z.natural().min(1).default(3).volatile().description('分段发送：每一条最多等几秒打字'),
    // 进度提示（本插件新增）：一轮跑太久还没出声时先应一声，免得对方以为掉线
    progressEnabled: z.boolean().default(true).volatile().description('进度提示：跑超过几秒还没回复就先发一句「在弄了」'),
    progressDelaySeconds: z.natural().min(1).default(6).volatile().description('进度提示：超过几秒还没出声才发'),
    progressMinGapSeconds: z.natural().min(1).default(20).volatile().description('进度提示：两条之间至少隔几秒'),
    progressMaxPerTurn: z.natural().min(1).default(4).volatile().description('进度提示：一轮最多发几条'),
    progressHeartbeatSeconds: z.natural().min(5).default(10).volatile().description('进度提示：心跳检查间隔（单个工具跑很久也能覆盖到）'),
    // 掉线检测和提醒（本插件新增）
    watchEnabled: z.boolean().default(true).volatile().description('小号掉线检测：NapCat 报下线、心跳不在线、定时问不到时提醒'),
    watchIntervalMinutes: z.natural().min(1).default(2).volatile().description('每几分钟主动问一次小号在不在线'),
    watchGraceMinutes: z.natural().default(3).volatile().description('问题持续几分钟才提醒（重启、网络抖一下不吵你；NapCat 明确报下线时不等）'),
    alertRepeatHours: z.natural().default(6).volatile().description('还没恢复时每隔几小时再提醒一次（0 = 只提醒一次）'),
    alertOnRecover: z.boolean().default(true).volatile().description('恢复后再发一条「恢复了」'),
    mailEnabled: z.boolean().default(false).volatile().description('用邮件提醒'),
    smtpHost: z.string().default('').volatile().description('发信服务器（SMTP），例如 smtp.qq.com'),
    smtpPort: z.natural().min(1).max(65535).default(465).volatile().description('SMTP 端口（465 加密；587 STARTTLS）'),
    smtpUser: z.string().default('').volatile().description('发信邮箱账号'),
    smtpPass: z.string().role('secret').volatile().description('邮箱授权码（不是登录密码）'),
    mailTo: z.string().default('').volatile().description('收件人；空 = 发给自己'),
    pushService: z.union(['off', 'serverchan', 'pushplus']).default('off').volatile().description('微信推送：Server酱 或 PushPlus'),
    pushKey: z.string().role('secret').volatile().description('Server酱的 SendKey 或 PushPlus 的 token'),
    // 文字转语音（本插件新增）：每条先用 BreezeBlue，这条不行就换 Inworld
    ttsEnabled: z.boolean().default(false).volatile().description('文字转语音：她的回复可以用语音发（要填至少一家的 Key 和音色 id）'),
    ttsMode: z.union(['tag', 'always', 'chance']).default('tag').volatile().description('什么时候用语音：tag 她自己决定（那一行开头写 [语音]），always 每条都用，chance 按概率'),
    ttsChance: z.natural().max(100).default(30).volatile().description('按概率时：一次回复用语音的概率（%）'),
    ttsAdminPrivate: z.boolean().default(true).volatile().description('主人私聊里可以发语音'),
    ttsPrivate: z.boolean().default(false).volatile().description('其他私聊里可以发语音'),
    ttsGroup: z.boolean().default(false).volatile().description('群里可以发语音'),
    ttsMaxChars: z.natural().min(1).default(150).volatile().description('一条语音最多念几个字，超过就发文字'),
    ttsAlsoText: z.boolean().default(false).volatile().description('发语音后再发一条同样内容的文字'),
    ttsStripParens: z.boolean().default(true).volatile().description('念之前去掉括号里的动作、表情描写'),
    ttsSpeed: z.natural().min(50).max(150).default(100).volatile().description('语速（%），100 = 正常'),
    breezeApiKey: z.string().role('secret').volatile().description('BreezeBlue 的 API Key'),
    breezeVoiceId: z.string().default('').volatile().description('BreezeBlue 的音色 id（克隆音色也行，要和 Key 同一个账号）'),
    breezeModel: z.string().default('breeze-tts-2').volatile().description('BreezeBlue 的模型'),
    breezeLanguage: z.string().default('zh').volatile().description('BreezeBlue 的语言代码（zh 中文；留空让它自己判断）'),
    inworldApiKey: z.string().role('secret').volatile().description('Inworld 的 API Key（后台给的 Basic 那一串）'),
    inworldVoiceId: z.string().default('').volatile().description('Inworld 的音色 id（克隆音色也行，要和 Key 同一个工作区）'),
    inworldModel: z.string().default('inworld-tts-2-flash').volatile().description('Inworld 的模型'),
    logLevel: z.union(['debug', 'info', 'warn', 'error']).default('info').volatile().description('日志级别'),
});
export const name = 'dsh-napcat-bridge';
// agentDefaultModel / agentPresets / sessionPersistence 是可选的，用到时再 ctx.get
export const inject = ['agents'];
const RANK = { debug: 0, info: 1, warn: 2, error: 3 };
/** 多久检查一次监听地址/端口有没有被设置页改过。 */
const ADDRESS_POLL_MS = 1000;
export function apply(ctx, live) {
    // 密钥字段不设默认值（设置页才能分清"没设置"和"设成空"），读不到时当空字符串
    const get = (key) => (live[key]?.get() ?? (key === 'ws_reverse_token' || key === 'sttApiKey' ? '' : undefined));
    const log = (level, message) => {
        if (RANK[level] < RANK[get('logLevel')])
            return;
        const line = '[napcat-bridge] ' + message;
        if (level === 'error')
            console.error(line);
        else if (level === 'warn')
            console.warn(line);
        else
            console.log(line);
    };
    const callAction = (action, params = {}) => adapter.bot.callAction(action, params);
    const videoSettings = () => ({
        enabled: get('videoFrames'),
        maxFrames: get('videoMaxFrames'),
        secondsPerFrame: get('videoSecondsPerFrame'),
        maxEdge: get('videoMaxEdge'),
        maxMB: get('videoMaxMB'),
        maxMinutes: get('videoMaxMinutes'),
        timeoutSeconds: get('videoTimeoutSeconds'),
        ffmpegPath: get('ffmpegPath'),
    });
    const ttsSettings = () => ({
        enabled: get('ttsEnabled'), mode: get('ttsMode'), chance: get('ttsChance'),
        adminPrivate: get('ttsAdminPrivate'), private: get('ttsPrivate'), group: get('ttsGroup'),
        maxChars: get('ttsMaxChars'), alsoText: get('ttsAlsoText'), stripParens: get('ttsStripParens'), speed: get('ttsSpeed'),
        timezone: get('timezone'),
        breeze: { key: get('breezeApiKey') ?? '', voiceId: get('breezeVoiceId'), model: get('breezeModel'), language: get('breezeLanguage') },
        inworld: { key: get('inworldApiKey') ?? '', voiceId: get('inworldVoiceId'), model: get('inworldModel') },
    });
    const tts = new Tts({ settings: ttsSettings, log: (level, message) => log(level, message) });
    const sttSettings = () => ({ mode: get('sttMode'), command: get('sttCommand'), apiUrl: get('sttApiUrl'), apiKey: get('sttApiKey'), model: get('sttModel') });
    const media = new Media({
        callAction,
        attachments: () => ctx.get('attachments'),
        settings: () => ({ imageToModel: get('imageToModel'), maxImages: get('maxImages'), stt: sttSettings(), video: videoSettings() }),
        log,
    });
    const bridge = new Bridge({
        agents: ctx.agents,
        defaultModel: () => ctx.get('agentDefaultModel'),
        presets: () => ctx.get('agentPresets'),
        persistence: () => ctx.get('sessionPersistence'),
        media,
        callAction,
        onSessionEvent: listener => ctx.on('session/event', ((session, event) => listener(session, event))),
        emit: (abm, event, isWake) => ctx.emit('napcat/message', abm, event, isWake),
        prompt: payload => ctx.serial('napcat/prompt', payload),
        sent: payload => ctx.emit('napcat/sent', payload),
        sessionChanged: change => ctx.emit('napcat/session-changed', change),
        sendBySession: (session, chain) => adapter.sendBySession(session, chain),
        selfId: () => adapter.bot.connections()[0]?.selfId,
        store: new SessionStore(join(defaultDataDir(), 'sessions.json')),
        settings: () => ({
            cwd: get('workspacePath') || process.cwd(),
            wake: {
                wakePrefix: [...get('wake_prefix')],
                wakeKeywords: [...get('wakeKeywords')],
                ignoreBotSelfMessage: get('ignore_bot_self_message'),
                friendMessageNeedsWakePrefix: get('friend_message_needs_wake_prefix'),
            },
            identifier: get('identifier'),
            imageToModel: get('imageToModel'),
            maxImages: get('maxImages'),
            admins: get('admins').map(String),
            whitelist: {
                enabled: get('whitelistEnabled'),
                groupIds: get('groupWhitelist') ?? legacyWhitelistFor(get('whitelist'), MessageType.GROUP_MESSAGE),
                privateIds: get('privateWhitelist') ?? legacyWhitelistFor(get('whitelist'), MessageType.FRIEND_MESSAGE),
                log: get('whitelistLog'),
            },
            rateLimit: { count: get('rateLimitCount'), seconds: get('rateLimitSeconds'), strategy: get('rateLimitStrategy') },
            emptyMention: { waiting: get('emptyMentionWaiting'), needReply: get('emptyMentionNeedReply') },
            uniqueSession: get('uniqueSession'),
            reminder: { datetime: get('datetimeReminder'), timezone: get('timezone'), groupName: get('groupNameDisplay'), markAdmin: get('markAdmin'), markWake: get('markWake') ?? true },
            commands: { enabled: get('commandsEnabled'), noPermissionReply: get('noPermissionReply') },
            presets: { default: get('agentPreset'), private: get('privateAgentPreset'), group: get('groupAgentPreset'), adminPrivate: get('adminPrivateAgentPreset') },
            models: { private: get('privateModel'), group: get('groupModel'), adminPrivate: get('adminPrivateModel') },
            reasoning: { private: get('privateReasoning'), group: get('groupReasoning'), adminPrivate: get('adminPrivateReasoning') },
            stt: sttSettings(),
            video: videoSettings(),
            silenceToken: get('silenceToken') ?? '[不发]',
            nudgeOnEmpty: get('nudgeOnEmpty') ?? true,
            pace: {
                typingPrivate: get('typingPrivate'), typingGroup: get('typingGroup'), charsPerMinute: get('typingCharsPerMinute'),
                typingMinSeconds: get('typingMinSeconds'), typingMaxSeconds: get('typingMaxSeconds'),
                groupMinGapSeconds: get('groupMinGapSeconds'), groupMaxPerWindow: get('groupMaxPerWindow'), groupWindowSeconds: get('groupWindowSeconds'),
                maxWaitSeconds: get('sendMaxWaitSeconds'),
            },
            groupReply: { mention: get('groupReplyMention'), quote: get('groupReplyQuote') },
            segment: { adminPrivate: get('segmentAdminPrivate'), private: get('segmentPrivate'), group: get('segmentGroup'), maxSegments: get('segmentMax'), maxSecondsPerSegment: get('segmentMaxSeconds') },
            progress: {
                enabled: get('progressEnabled') ?? true,
                delaySeconds: get('progressDelaySeconds') ?? 6,
                minGapSeconds: get('progressMinGapSeconds') ?? 20,
                maxPerTurn: get('progressMaxPerTurn') ?? 4,
                heartbeatSeconds: get('progressHeartbeatSeconds') ?? 10,
            },
            tts: ttsSettings(),
        }),
        tts,
        log,
    });
    const adapter = new AiocqhttpAdapter({
        id: () => get('id'),
        ws_reverse_host: get('ws_reverse_host'),
        ws_reverse_port: get('ws_reverse_port'),
        ws_reverse_token: () => get('ws_reverse_token'),
        log,
        onMessage: (abm, event) => bridge.handle(abm, event),
    });
    const service = {
        canArchive: session => bridge.canArchive(session),
        adapter,
        callAction,
        sendBySession: async (session, chain) => {
            await bridge.sendBySession(session, chain);
            const text = chain.chain.filter(c => c.type === 'Plain').map(c => String(c.text ?? '')).join('');
            bridge.notifySent({ umo: sessionToString(session), session, text, chain, source: 'service', time: Date.now() });
        },
        sessions: () => bridge.sessions(),
        masterPrivateBindings: () => bridge.masterPrivateBindings(get('id')),
        restoreMasterPrivateBinding: (ownerId, sessionId) => bridge.restoreMasterPrivateBinding(get('id'), ownerId, sessionId),
        sessionInfo: sessionId => bridge.sessionInfo(sessionId),
        sessionInfoByUmo: umo => bridge.sessionInfoByUmo(umo),
        rotateSession: umo => bridge.rotateSession(umo),
        media,
        wake: (umo, content) => bridge.wake(umo, content),
    };
    ctx.provide('napcat', service);
    // 视频抽帧用的 ffmpeg：设置页查状态、一键安装
    let install = { state: 'idle' };
    const ffmpegStatus = async (fresh) => {
        const found = await findFfmpeg(get('ffmpegPath'), fresh);
        return {
            found: found ?? null,
            installSupported: platformTag() !== undefined,
            platform: process.platform + '-' + process.arch,
            install,
        };
    };
    const startInstall = () => {
        if (['downloading', 'verifying', 'extracting'].includes(install.state))
            return;
        install = { state: 'downloading' };
        log('info', '开始安装 ffmpeg');
        installFfmpeg({ onProgress: next => { install = next; } }).then(found => {
            install = { state: 'done', version: found.version, finishedAt: Date.now() };
            log('info', 'ffmpeg 已安装：' + found.version);
        }, (error) => {
            install = { state: 'failed', error: errText(error), finishedAt: Date.now() };
            log('error', '安装 ffmpeg 失败: ' + errText(error));
        });
    };
    // 设置页「测试连接」：GET <dsh>/api/napcat-bridge/status。
    // 挂在 dsh 的 /api 钩子上，请求先通过 dsh 网页的登录校验才会到这里；返回里不含 Token。
    const status = async () => {
        const bot = adapter.bot;
        const connections = bot.connections();
        let login;
        let loginError;
        if (connections.length > 0) {
            try {
                const info = await Promise.race([
                    bot.callAction('get_login_info', { self_id: connections[0].selfId }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('5 秒内没有回应')), 5000)),
                ]);
                login = { user_id: info?.user_id, nickname: info?.nickname };
            }
            catch (error) {
                loginError = error instanceof Error ? error.message : String(error);
            }
        }
        const rejected = bot.lastRejected !== undefined && Date.now() - bot.lastRejected.at < 10 * 60_000 ? bot.lastRejected : undefined;
        return {
            listening: bot.listening,
            address: get('ws_reverse_host') + ':' + get('ws_reverse_port'),
            tokenSet: get('ws_reverse_token') !== '',
            connections,
            login,
            loginError,
            lastRejected: rejected,
        };
    };
    // 视频：GET <dsh>/api/napcat-bridge/ffmpeg 查状态；POST <dsh>/api/napcat-bridge/ffmpeg/install 开始安装
    ctx.on('connection/request', (async (req, res, next) => {
        const path = new URL(req.url ?? '/', 'http://localhost').pathname;
        const json = (code, value) => {
            res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
            res.end(JSON.stringify(value));
        };
        if (path.endsWith('/napcat-bridge/status'))
            return json(200, await status());
        // 掉线检测：GET …/watch 看状态（?fresh=1 先问一次）；POST …/alert/test { channel: 'mail' | 'push' } 用保存过的设置发一条测试提醒
        // 设置页文字转语音：GET <dsh>/api/napcat-bridge/tts/status（今天用了多少、Breeze 是不是在跳过）；
        // POST …/tts/test { provider, text?, form? }（只用这一家念一句，返回 base64 的 mp3 给页面播放；form 是页面上现在填的值，没填的用保存过的）
        if (path.endsWith('/napcat-bridge/tts/status') && req.method === 'GET')
            return json(200, tts.status());
        if (path.endsWith('/napcat-bridge/tts/test')) {
            if (req.method !== 'POST')
                return json(405, { error: 'POST only' });
            let body = {};
            try {
                const chunks = [];
                for await (const c of req)
                    chunks.push(c);
                body = JSON.parse(Buffer.concat(chunks).toString('utf8').slice(0, 16 * 1024) || '{}');
            }
            catch {
                return json(400, { error: 'bad json' });
            }
            const form = body.form !== null && typeof body.form === 'object' ? body.form : {};
            const f = (k) => (typeof form[k] === 'string' && String(form[k]).trim() !== '' ? String(form[k]).trim() : undefined);
            const saved = ttsSettings();
            const speed = Number(f('ttsSpeed'));
            const s = {
                ...saved,
                speed: Number.isInteger(speed) && speed >= 50 && speed <= 150 ? speed : saved.speed,
                stripParens: f('ttsStripParens') === undefined ? saved.stripParens : f('ttsStripParens') === 'true',
                breeze: { key: f('breezeApiKey') ?? saved.breeze.key, voiceId: f('breezeVoiceId') ?? saved.breeze.voiceId, model: f('breezeModel') ?? saved.breeze.model, language: typeof form.breezeLanguage === 'string' ? form.breezeLanguage.trim() : saved.breeze.language },
                inworld: { key: f('inworldApiKey') ?? saved.inworld.key, voiceId: f('inworldVoiceId') ?? saved.inworld.voiceId, model: f('inworldModel') ?? saved.inworld.model },
            };
            const text = typeof body.text === 'string' ? body.text.slice(0, 500) : '';
            return json(200, await testSpeak(s, body.provider === 'inworld' ? 'inworld' : 'breeze', text));
        }
        if (path.endsWith('/napcat-bridge/watch') && req.method === 'GET') {
            const fresh = new URL(req.url ?? '/', 'http://localhost').searchParams.get('fresh') === '1';
            return json(200, { ...(fresh ? await watchdog.check() : watchdog.status()), enabled: get('watchEnabled') });
        }
        if (path.endsWith('/napcat-bridge/alert/test')) {
            if (req.method !== 'POST')
                return json(405, { error: 'POST only' });
            let body = {};
            try {
                const chunks = [];
                for await (const c of req)
                    chunks.push(c);
                body = JSON.parse(Buffer.concat(chunks).toString('utf8').slice(0, 4096) || '{}');
            }
            catch {
                return json(400, { error: 'bad json' });
            }
            const channel = body.channel === 'push' ? 'push' : 'mail';
            const form = body.form;
            const results = await sendAlerts(alertMessage('test', watchdog.status()), channel, form !== null && typeof form === 'object' ? form : undefined);
            return json(200, { ok: results.every(r => r.endsWith('已发送')), results });
        }
        if (path.endsWith('/napcat-bridge/ffmpeg') && req.method === 'GET')
            return json(200, await ffmpegStatus(true));
        // 设置页「测试」语音转文字：POST <dsh>/api/napcat-bridge/stt/test（用保存过的设置，拿一段静音试）
        // 设置页「获取模型列表」：POST <dsh>/api/napcat-bridge/stt/models { apiUrl?, apiKey?, query? }（没给的用保存过的；Key 只在这次请求里用）
        // 设置页选模型：GET <dsh>/api/napcat-bridge/llm/dsh-models（dsh 里配置的模型）；POST …/llm/efforts { provider, model }（这个模型能选哪些思考等级）
        if (path.endsWith('/napcat-bridge/llm/dsh-models') && req.method === 'GET') {
            const l = ctx.get('llm');
            if (l === undefined)
                return json(200, { providers: [], default: null });
            const providers = [];
            for (const p of (l.listProviders?.() ?? [])) {
                let models = [];
                try {
                    models = (await l.listModels(p.id)).map(m => ({ id: m.id, name: m.name || m.id }));
                }
                catch {
                    models = [];
                }
                providers.push({ id: p.id, name: p.name || p.id, models });
            }
            const sel = ctx.get('agentDefaultModel')?.currentSelection?.();
            return json(200, { providers, default: sel ? { provider: sel.provider, model: sel.model } : null });
        }
        if (path.endsWith('/napcat-bridge/llm/efforts')) {
            if (req.method !== 'POST')
                return json(405, { error: 'POST only' });
            let body = {};
            try {
                const chunks = [];
                for await (const c of req)
                    chunks.push(c);
                body = JSON.parse(Buffer.concat(chunks).toString('utf8').slice(0, 64 * 1024) || '{}');
            }
            catch {
                return json(400, { error: 'bad json' });
            }
            const l = ctx.get('llm');
            const sel = ctx.get('agentDefaultModel')?.currentSelection?.();
            const provider = typeof body.provider === 'string' && body.provider ? body.provider : sel?.provider;
            const model = typeof body.model === 'string' && body.model ? body.model : sel?.model;
            if (l === undefined || !provider || !model)
                return json(200, { efforts: [], model: null });
            try {
                const info = await l.resolveModelInfo(provider, model);
                return json(200, { efforts: (info?.reasoning?.efforts ?? []).map((e) => ({ id: String(e.id), name: String(e.name ?? e.id) })), model: { provider, model } });
            }
            catch (e) {
                return json(200, { efforts: [], error: e instanceof Error ? e.message : String(e), model: { provider, model } });
            }
        }
        if (path.endsWith('/napcat-bridge/stt/models')) {
            if (req.method !== 'POST')
                return json(405, { error: 'POST only' });
            if (!String(req.headers['content-type'] ?? '').includes('application/json'))
                return json(415, { error: 'application/json only' });
            let body = {};
            try {
                const chunks = [];
                let size = 0;
                for await (const c of req) {
                    size += c.length;
                    if (size > 64 * 1024)
                        return json(413, { error: 'too large' });
                    chunks.push(c);
                }
                body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
            }
            catch {
                return json(400, { error: 'bad json' });
            }
            const s = sttSettings();
            const url = typeof body.apiUrl === 'string' && body.apiUrl.trim() ? body.apiUrl : s.apiUrl;
            const key = typeof body.apiKey === 'string' && body.apiKey.trim() ? body.apiKey : s.apiKey;
            return json(200, await listModels(url, key, 'stt', typeof body.query === 'string' ? body.query : ''));
        }
        if (path.endsWith('/napcat-bridge/stt/test')) {
            if (req.method !== 'POST')
                return json(405, { error: 'POST only' });
            return json(200, await testStt(sttSettings()));
        }
        if (path.endsWith('/napcat-bridge/ffmpeg/install')) {
            if (req.method !== 'POST')
                return json(405, { error: 'POST only' });
            startInstall();
            return json(200, await ffmpegStatus(false));
        }
        return next();
    }));
    // 本插件自带设置页（client.js），告诉 dsh 不用按 schema 自动生成表单
    ctx.inject(['settings'], child => {
        child.effect(() => child.settings.configure({ auto: false }, ctx.fiber), 'napcat-bridge: settings policy');
    });
    const errText = (error) => (error instanceof Error ? error.message : String(error));
    //#region 掉线检测和提醒
    const mailSettings = () => ({ enabled: get('mailEnabled'), host: get('smtpHost'), port: get('smtpPort'), user: get('smtpUser'), pass: get('smtpPass') ?? '', to: get('mailTo') });
    const pushSettings = () => ({ service: get('pushService'), key: get('pushKey') ?? '' });
    const STATE_TEXT = { offline: '掉线了', disconnected: 'NapCat 没连上', unknown: '问不到在不在线', ok: '在线' };
    const fmtTime = (t) => new Date(t).toLocaleString('zh-CN', { timeZone: get('timezone') || 'Asia/Shanghai', hour12: false });
    const alertMessage = (kind, st) => {
        const who = st.account ? (st.account.nickname ? st.account.nickname + '（' + st.account.userId + '）' : st.account.userId) : 'QQ 小号';
        if (kind === 'test')
            return { title: '【测试】' + who + ' 的掉线提醒', text: '这是 dsh-napcat-bridge 的测试提醒，收到说明这个渠道能用。\n\n现在的状态：' + STATE_TEXT[st.state] + '（' + fmtTime(st.since) + ' 起）' };
        if (kind === 'recovered')
            return { title: who + ' 恢复在线了', text: who + ' 在 ' + fmtTime(Date.now()) + ' 恢复在线。' };
        return {
            title: who + ' ' + STATE_TEXT[st.state],
            text: [
                who + ' ' + STATE_TEXT[st.state] + '（从 ' + fmtTime(st.since) + ' 开始）。',
                st.reason ? '原因：' + st.reason : '',
                '',
                st.state === 'disconnected'
                    ? '可能 NapCat 没在运行，或者连接 Token / 端口不对。先看服务器上 NapCat 的状态和日志。'
                    : '多半要重新登录：打开 NapCat 网页扫码，或者看 NapCat 日志里的二维码。登录好以后会自动恢复，恢复时会再通知你。',
                '',
                '这条提醒来自 dsh-napcat-bridge 的掉线检测（可以在它的设置页「连接和权限」里调整）。',
            ].filter((x, i, a) => x !== '' || a[i - 1] !== '').join('\n'),
        };
    };
    /** form：设置页测试按钮带来的、页面上现在填的值（没保存的也算）；空的用保存过的 */
    const sendAlerts = async (m, only, form) => {
        const results = [];
        const f = (k) => (typeof form?.[k] === 'string' && String(form[k]).trim() !== '' ? String(form[k]).trim() : undefined);
        const saved = mailSettings(), savedPush = pushSettings();
        const port = Number(f('smtpPort'));
        const mail = { ...saved, host: f('smtpHost') ?? saved.host, port: Number.isInteger(port) && port > 0 ? port : saved.port, user: f('smtpUser') ?? saved.user, to: form ? (f('mailTo') ?? '') : saved.to, pass: f('smtpPass') ?? saved.pass };
        const svc = f('pushService');
        const push = { service: (svc === 'serverchan' || svc === 'pushplus' || svc === 'off' ? svc : savedPush.service), key: f('pushKey') ?? savedPush.key };
        if ((only === undefined && mail.enabled) || only === 'mail') {
            try {
                await sendMail(mail, m);
                results.push('邮件：已发送');
            }
            catch (e) {
                results.push('邮件：没发出去（' + errText(e) + '）');
            }
        }
        if ((only === undefined && push.service !== 'off') || only === 'push') {
            try {
                await sendPush(push, m);
                results.push('微信推送：已发送');
            }
            catch (e) {
                results.push('微信推送：没发出去（' + errText(e) + '）');
            }
        }
        return results;
    };
    const watchdog = new Watchdog({
        settings: () => ({ enabled: get('watchEnabled'), intervalMinutes: get('watchIntervalMinutes'), graceMinutes: get('watchGraceMinutes'), repeatHours: get('alertRepeatHours'), alertOnRecover: get('alertOnRecover') }),
        connections: () => adapter.bot.connections(),
        callAction,
        alert: (kind, st) => sendAlerts(alertMessage(kind, st)),
        log,
    });
    adapter.bot.on('notice.bot_offline')(async (event) => { watchdog.onOffline(event); });
    adapter.bot.on('meta_event.heartbeat')(async (event) => { watchdog.onHeartbeat(event); });
    ctx.effect(() => {
        let last = 0;
        const timer = setInterval(() => {
            if (!get('watchEnabled'))
                return;
            if (Date.now() - last < Math.max(1, get('watchIntervalMinutes')) * 60_000)
                return;
            last = Date.now();
            void watchdog.check().catch(e => log('warn', '掉线检测出错：' + errText(e)));
        }, 20_000);
        return () => clearInterval(timer);
    }, 'napcat-bridge: watchdog');
    //#endregion
    const migrateWhitelists = async () => {
        // settings.describe() 只列 state=2 的实例；要等 Loader 完成挂载，不能在 apply 期间查自己的表单。
        await ctx.root.loader.await();
        if (ctx.fiber.state !== 2)
            throw new Error('插件已停止，取消白名单迁移');
        const svc = ctx.get('settings');
        const form = svc?.describe({ redactSecrets: true }).find(f => 'ws_reverse_host' in (f.value ?? {}) && 'wakeKeywords' in (f.value ?? {}));
        if (svc === undefined || form === undefined)
            throw new Error('没有找到本插件设置，无法迁移旧白名单');
        // 以 user 层是否显式设置为准，宿主可能把缺省数组解析为 []，不能仅靠 get() 判断。
        const ops = ['groupWhitelist', 'privateWhitelist']
            .filter(k => !Array.isArray(form.user?.[k]))
            .map(k => ({ op: 'set', path: [k], value: legacyWhitelistFor(get('whitelist'), k === 'groupWhitelist' ? MessageType.GROUP_MESSAGE : MessageType.FRIEND_MESSAGE) }));
        // 迁移后清空旧字段，之后重置或清空新名单不会重新启用旧号码。
        if (get('whitelist').length > 0)
            ops.push({ op: 'set', path: ['whitelist'], value: [] });
        if (ops.length === 0)
            return;
        await svc.mutate(form.ns, ops);
        log('info', '旧白名单已迁移为群聊和私聊两份名单，之后分别保存、互不影响');
    };
    ctx.effect(() => {
        let address = get('ws_reverse_host') + ':' + get('ws_reverse_port');
        let switching = migrateWhitelists().then(() => adapter.run()).then(() => log('info', '反向 WebSocket 已监听 ' + address), (error) => log('error', '启动反向 WebSocket 失败: ' + errText(error)));
        // 设置页改了监听地址或端口：关掉旧的服务，用新地址重新监听（NapCat 会自动重连）
        const timer = setInterval(() => {
            const host = get('ws_reverse_host');
            const port = get('ws_reverse_port');
            const next = host + ':' + port;
            if (next === address)
                return;
            address = next;
            switching = switching.then(() => adapter.restart(host, port)).then(() => log('info', '监听地址已改为 ' + next), (error) => log('error', '改用新监听地址失败: ' + errText(error)));
        }, ADDRESS_POLL_MS);
        return async () => {
            clearInterval(timer);
            await switching;
            await adapter.terminate();
            await bridge.dispose();
        };
    }, 'napcat-bridge');
}
export { MessageType };
