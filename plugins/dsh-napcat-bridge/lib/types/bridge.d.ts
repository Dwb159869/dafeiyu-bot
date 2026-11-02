import type { AgentRegistry } from '@deepseek-ai/dsh-agent';
import type { Session, SessionEvent } from '@deepseek-ai/dsh-session';
import { AiocqhttpMessageEvent, MessageType, sessionToString, type AstrBotMessage, type MessageSession } from './adapter.js';
import { type MessageChain } from './components.js';
import type { VideoSettings } from './ffmpeg.js';
import type { Media, ModelPart } from './media.js';
import type { SttSettings } from './stt.js';
import type { SessionStore } from './store.js';
import { type PaceSettings } from './pacer.js';
import { type SegmentSettings } from './segment.js';
import { type Speech, type TtsSettings } from './tts.js';
import type { Logger } from './onebot/server.js';
interface GroupReplyTarget {
    userId: string;
    messageId: string;
}
declare module '@deepseek-ai/dsh-llm' {
    interface MessageSourceMap {
        /** 从 QQ（NapCat）来的用户消息 */
        'plugin:napcat-bridge': {
            kind: 'plugin:napcat-bridge';
            replyTo?: GroupReplyTarget;
        };
        /** 其他插件主动唤醒她（ctx.napcat.wake，比如定时主动聊天）；不算"人说的话" */
        'plugin:napcat-bridge-wake': {
            kind: 'plugin:napcat-bridge-wake';
        };
        /** 她一轮什么都没说出来时，提醒她把话说出来；不算"人说的话" */
        'plugin:napcat-bridge-nudge': {
            kind: 'plugin:napcat-bridge-nudge';
            replyTo?: GroupReplyTarget;
        };
    }
}
export interface WakeConfig {
    /** AstrBot wake_prefix，默认 ["/"] */
    wakePrefix: string[];
    /** 本插件新增：群消息里出现这些词（不用 @、不用在开头）也唤醒；英文不分大小写 */
    wakeKeywords?: string[];
    /** AstrBot platform_settings.ignore_bot_self_message，默认 false */
    ignoreBotSelfMessage: boolean;
    /** AstrBot platform_settings.friend_message_needs_wake_prefix，默认 false */
    friendMessageNeedsWakePrefix: boolean;
}
export interface BridgeDeps {
    agents: AgentRegistry;
    /** 新会话用的默认模型（dsh-agent-default-model） */
    defaultModel(): {
        currentSelection(): {
            provider: string;
            model: string;
            reasoningEffort?: string;
        } | undefined;
    } | undefined;
    /** 预设挂载（可选） */
    presets(): {
        mount(agentCtx: unknown, id?: string): Promise<{
            id: string;
        }>;
        readonly defaultId?: string;
    } | undefined;
    /** 判断会话日志是否已存在（可选；存在时 resume 而不是 create） */
    persistence(): {
        stat(id: string): Promise<object | undefined>;
    } | undefined;
    /** 会话事件来源（ctx.on('session/event')） */
    onSessionEvent(listener: (session: Session, event: SessionEvent) => void): () => void;
    /** 图片、语音、视频 → 模型内容 */
    media: Media;
    /** 调 OneBot API（读图片时 get_image 兜底） */
    callAction(action: string, params: Record<string, unknown>): Promise<any>;
    /** 广播给其他插件 */
    emit(abm: AstrBotMessage, event: AiocqhttpMessageEvent, isWake: boolean): void;
    /** 交给模型前让其他插件加内容（ctx.serial('napcat/prompt')） */
    prompt(payload: PromptPayload): Promise<unknown>;
    /** 她发出了一条消息（ctx.emit('napcat/sent')） */
    sent(payload: SentPayload): void;
    /** QQ 会话换了 dsh 会话（ctx.emit('napcat/session-changed')） */
    sessionChanged(change: SessionChange): void;
    /** 按会话主动发送（没有收到的消息可回复时用，比如主动唤醒以后） */
    sendBySession(session: MessageSession, chain: MessageChain): Promise<void>;
    /** 她自己的 QQ 号（NapCat 连上以后才有） */
    selfId(): string | undefined;
    /** 当前设置（每次用到时读取，设置页改了立即生效） */
    settings(): BridgeSettings;
    /** 记住每个 QQ 会话当前的 dsh 会话 id */
    store: SessionStore;
    log: Logger;
    /** 测试用：替换等待 */
    sleep?: (ms: number) => Promise<void>;
    /** 文字转语音（本插件新增，见 tts.ts）；没有时一律发文字 */
    tts?: {
        speak(text: string): Promise<Speech>;
    };
}
export interface BridgeSettings {
    cwd: string;
    wake: WakeConfig;
    /** 群消息前面加 [昵称(QQ号)]，让模型知道是谁在说话 */
    identifier: boolean;
    /** 图片交给模型 */
    imageToModel: boolean;
    /** 一条消息最多交几张图片（含引用消息里的）；0 = 不限 */
    maxImages: number;
    /** AstrBot admins_id：管理员 QQ 号 */
    admins: string[];
    /** AstrBot enable_id_white_list / id_whitelist / wl_ignore_admin_* / id_whitelist_log */
    whitelist: {
        enabled: boolean;
        groupIds: string[];
        privateIds: string[];
        log: boolean;
    };
    /** AstrBot rate_limit：time 秒内最多 count 条；strategy stall=排队 discard=丢弃；count 0 = 不限 */
    rateLimit: {
        count: number;
        seconds: number;
        strategy: 'stall' | 'discard';
    };
    /** AstrBot empty_mention_waiting / empty_mention_waiting_need_reply */
    emptyMention: {
        waiting: boolean;
        needReply: boolean;
    };
    /** AstrBot unique_session：群里每人单独一个会话 */
    uniqueSession: boolean;
    /** AstrBot datetime_system_prompt / group_name_display / timezone；markAdmin、markWake 为本插件新增 */
    reminder: {
        datetime: boolean;
        timezone: string;
        groupName: boolean;
        markAdmin: boolean;
        markWake: boolean;
    };
    /** QQ 里的指令（/help /sid /new /reset /stop）；noPermissionReply 同 AstrBot */
    commands: {
        enabled: boolean;
        noPermissionReply: boolean;
    };
    /** 新会话用的预设：主人私聊 > 私聊/群聊 > 默认（空 = 往下找） */
    presets: {
        default: string;
        private: string;
        group: string;
        adminPrivate: string;
    };
    /** 新会话用的模型，写成 提供方/模型（空 = 用 dsh 默认模型） */
    models: {
        private: string;
        group: string;
        adminPrivate: string;
    };
    /** 思考等级（本插件新增）：主人私聊 / 其他私聊 / 群聊；空 = 跟默认模型 */
    reasoning: {
        private: string;
        group: string;
        adminPrivate: string;
    };
    stt: SttSettings;
    video: VideoSettings;
    /** 她回复里以这个开头时不发出去（主动唤醒时她决定不说话用） */
    silenceToken: string;
    /** 一轮结束时什么都没说出来，提醒她一次 */
    nudgeOnEmpty: boolean;
    /** 发消息的节奏：打字速度、群里的发言频率（本插件新增，见 pacer.ts） */
    pace: PaceSettings;
    /** 本插件新增：群聊回复首条文字可 @ 来信人、引用来信；默认均关闭。 */
    groupReply: {
        mention: boolean;
        quote: boolean;
    };
    /** 分段发送（本插件新增，见 segment.ts） */
    segment: SegmentSettings;
    /** 文字转语音（本插件新增，见 tts.ts） */
    tts: TtsSettings;
}
/** 一个 dsh 会话对应哪个 QQ 会话（本插件新增，给其他插件按会话分规则用）。 */
export interface SessionInfo {
    /** unified_msg_origin */
    umo: string;
    /** dsh 会话 id */
    sessionId: string;
    /** 平台 ID（设置里的 id） */
    platformId: string;
    /** 她自己的 QQ 号 */
    selfId: string;
    type: 'private' | 'group';
    /** 私聊：对方 QQ 号；群里每人单独一个会话时：这个人的 QQ 号 */
    userId?: string;
    /** 群号 */
    groupId?: string;
    /** 管理员（主人）的私聊 */
    adminPrivate: boolean;
}
/** 'napcat/prompt' 的参数：监听者直接改 content（在前后插入文字或图片）。 */
export interface PromptPayload {
    info: SessionInfo;
    /** 这是这个 dsh 会话的第一轮（刚新建的会话） */
    newSession: boolean;
    /** 唤醒她的那条消息 */
    message: AstrBotMessage;
    /**
     * 要交给模型的内容，还没经过 dsh 附件服务。
     * 元素是 { type: 'text', text } 或 { type: 'image', mediaType, data(base64) }，插件一之后统一交给附件服务。
     */
    content: ModelPart[];
}
/** 'napcat/sent' 的参数。 */
export interface SentPayload {
    /** unified_msg_origin */
    umo: string;
    session: MessageSession;
    /** 发出去的文字（只取文字部分） */
    text: string;
    chain: MessageChain;
    /** reply：她一轮说完的回复；service：其他插件通过 ctx.napcat.sendBySession 发的 */
    source: 'reply' | 'service';
    /** 发出的时间（毫秒） */
    time: number;
}
/** 'napcat/session-changed' 的参数。 */
export interface SessionChange {
    umo: string;
    oldSessionId: string;
    newSessionId: string;
    /** command：QQ 里发了 /new 或 /reset；rotate：其他插件调用了 ctx.napcat.rotateSession */
    reason: 'command' | 'rotate';
}
/** 当前时间，格式同 AstrBot：2026-10-23 21:40 (GMT+8), Weekday: Friday */
export declare function formatNow(timezone: string, now?: Date): string;
/** dsh 会话 id：napcat-<平台>-<类型>-<会话> 去掉不安全字符。 */
export declare function dshSessionId(umo: string): string;
/**
 * WakingCheckStage.process 中与唤醒有关的部分（AstrBot 默认配置）。
 * 返回 null 表示不唤醒；否则返回处理后的 message_str（去掉了唤醒前缀）。
 */
export declare function wakingCheck(event: AiocqhttpMessageEvent, wake: WakeConfig): {
    isWake: boolean;
    messageStr: string;
    stop: boolean;
    prefixUsed: boolean;
};
/** 旧混合名单迁移：完整标识按类型分开，裸号码保留旧版两种匹配含义。 */
export declare function legacyWhitelistFor(ids: readonly string[], type: MessageType): string[];
export declare class Bridge {
    private readonly deps;
    private readonly chats;
    private readonly bySession;
    private readonly creating;
    /** dsh 会话 id → QQ 会话信息（建会话之前就登记，预设里的插件启动时就能查到） */
    private readonly infos;
    /** 只 @ 不说话的人：key = 会话|QQ 号，值 = 等到什么时候 */
    private readonly waiters;
    /** 频率限制：每个会话最近处理的时间 */
    private readonly timestamps;
    private readonly off;
    private readonly pacer;
    constructor(deps: BridgeDeps);
    /** unified_msg_origin；开了 unique_session 时群里按 QQ号_群号 分会话（同 AstrBot）。 */
    private umoOf;
    private isAdmin;
    /** 管理员始终豁免；普通群聊/私聊分别只查对应名单。群豁免必须来自真实来信发送者。 */
    canSend(session: MessageSession, senderId?: string): boolean;
    /** 本插件新增：存档按会话检查；群聊不继承管理员发言豁免，管理员私聊仍允许。 */
    canArchive(session: MessageSession): boolean;
    private checkAccess;
    /** 给其他插件代发时也检查，不能绕过群白名单。 */
    sendBySession(session: MessageSession, chain: MessageChain): Promise<void>;
    /** RateLimitStage（固定窗口）。返回 false 表示这条被丢弃。 */
    private rateLimit;
    /** 适配器 handle_msg 的去处。 */
    handle(abm: AstrBotMessage, event: AiocqhttpMessageEvent): Promise<void>;
    private isEmptyMention;
    private targetOf;
    private dispatch;
    /** QQ 里的指令。返回 true 表示已处理（不再交给模型）。 */
    private command;
    /** /new、/reset、rotateSession：换一个新的 dsh 会话，旧的留在 dsh 里。返回新旧会话 id。 */
    private startNewSession;
    /** 给其他插件用：让某个 QQ 会话换一个新的 dsh 会话（下一条消息进新会话）。 */
    rotateSession(umo: string): Promise<{
        oldSessionId: string;
        newSessionId: string;
    }>;
    /** 仅当前管理员的 QQ 私聊；不用存档分类或在线 chats 推测归属。 */
    masterPrivateBindings(platform: string): Array<{
        ownerId: string;
        prefix: string;
        sessionId: string;
        cwd: string;
    }>;
    /** 恢复后只接管当前管理员的私聊；原会话留存，不触发换会话的整理流程。 */
    restoreMasterPrivateBinding(platform: string, ownerId: string, sessionId: string): Promise<void>;
    private readonly restoring;
    /** dsh 会话 id → QQ 会话信息。 */
    sessionInfo(sessionId: string): SessionInfo | undefined;
    /** QQ 会话（unified_msg_origin）→ 当前的会话信息。 */
    sessionInfoByUmo(umo: string): SessionInfo | undefined;
    /** 她自己在各个群里的名片（群号 → 名片），10 分钟 */
    private readonly selfCards;
    /** 她自己在这个群里的群名片（没设名片用 QQ 昵称）；查不到返回空。 */
    private selfCard;
    /**
     * 本插件新增：群里被 @ 或被引用叫醒时告诉她「这条是在叫你」，以及她自己的 QQ 号和群名片。
     * 叫醒她的那个 @ 会照 AstrBot 的做法从文字里去掉，剩下的 @ 都是别人（比如回复别人时 QQ 自动带上的 @），
     * 不说清楚的话她会以为这条是在叫别人。
     */
    private wakeNote;
    /** AstrBot _append_system_reminders；markAdmin、markWake 为本插件新增。 */
    private reminder;
    /**
     * 交给模型的内容：（群里）[昵称(QQ号)] + 文字；有引用时接 <Quoted Message>（照 AstrBot），
     * 有聊天记录时接 <Forward Message>（本插件新增）；然后 <system_reminder>；最后是图片和视频截图。
     * 返回的内容还没交给 dsh 附件服务（dispatch 里统一交）。
     */
    private buildContent;
    private ensureChat;
    /**
     * 本插件新增：其他插件主动唤醒她（比如定时主动聊天）。给这个 QQ 会话的 dsh 会话发一条内容（来源 plugin:napcat-bridge-wake），
     * 她一轮说完的回复照常发到 QQ；回复以「不发」暗号开头时不发。会话还没建过时先建。群里每人单独一个会话的 umo 不支持。
     */
    wake(umo: string, content: ModelPart[] | string): Promise<{
        sessionId: string;
    }>;
    /** 这个会话该用的模型和思考等级：主人私聊 > 私聊/群聊 > dsh 默认模型（本插件新增思考等级）。 */
    private modelFor;
    private createChat;
    private onSessionEvent;
    /** 本插件新增：OneBot 引用在最前；对象来自来信元数据，不让模型猜 QQ 或消息 ID。 */
    private groupReplyChain;
    /** 发 'napcat/sent'；监听器出错不影响发送。 */
    notifySent(payload: SentPayload): void;
    /** 已建立的会话（unified_msg_origin → dsh 会话 id）。 */
    sessions(): Array<{
        umo: string;
        sessionId: string;
    }>;
    dispose(): Promise<void>;
}
/** 她只想没说时的提醒（不算对方说的话，记忆插件也不把它当一轮）。 */
export declare function nudgeText(silenceToken: string): string;
export { MessageType, sessionToString };
