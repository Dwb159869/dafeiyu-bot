import z from '@deepseek-ai/schemastery';
import type { Context as CordisContext } from '@deepseek-ai/cordis';
import type { AgentRegistry } from '@deepseek-ai/dsh-agent';
import { AiocqhttpAdapter, AiocqhttpMessageEvent, MessageType, type AstrBotMessage, type MessageSession } from './adapter.js';
import { type PromptPayload, type SentPayload, type SessionChange, type SessionInfo } from './bridge.js';
import type { MessageChain } from './components.js';
import { Media, type ModelPart } from './media.js';
import { type PushService } from './alert.js';
import { type TtsMode } from './tts.js';
export * from './adapter.js';
export * from './components.js';
export type { PromptPayload, SentPayload, SessionChange, SessionInfo } from './bridge.js';
export type { Converted, Media, ModelPart } from './media.js';
export { ActionFailed, ApiNotAvailable, NetworkError } from './onebot/errors.js';
export interface Config {
    id: string;
    ws_reverse_host: string;
    ws_reverse_port: number;
    ws_reverse_token: string;
    wake_prefix: string[];
    wakeKeywords: string[];
    friend_message_needs_wake_prefix: boolean;
    ignore_bot_self_message: boolean;
    workspacePath: string;
    agentPreset: string;
    identifier: boolean;
    imageToModel: boolean;
    maxImages: number;
    admins: string[];
    whitelistEnabled: boolean;
    whitelist: string[];
    groupWhitelist: string[] | undefined;
    privateWhitelist: string[] | undefined;
    whitelistIgnoreAdminOnGroup: boolean;
    whitelistIgnoreAdminOnFriend: boolean;
    whitelistLog: boolean;
    rateLimitCount: number;
    rateLimitSeconds: number;
    rateLimitStrategy: 'stall' | 'discard';
    emptyMentionWaiting: boolean;
    emptyMentionNeedReply: boolean;
    uniqueSession: boolean;
    datetimeReminder: boolean;
    timezone: string;
    groupNameDisplay: boolean;
    markAdmin: boolean;
    markWake: boolean;
    commandsEnabled: boolean;
    noPermissionReply: boolean;
    privateAgentPreset: string;
    groupAgentPreset: string;
    adminPrivateAgentPreset: string;
    privateModel: string;
    groupModel: string;
    adminPrivateModel: string;
    adminPrivateReasoning: string;
    privateReasoning: string;
    groupReasoning: string;
    sttMode: 'off' | 'command' | 'openai';
    sttCommand: string;
    sttApiUrl: string;
    sttApiKey: string;
    sttModel: string;
    videoFrames: boolean;
    videoMaxFrames: number;
    videoSecondsPerFrame: number;
    videoMaxEdge: number;
    videoMaxMB: number;
    videoMaxMinutes: number;
    videoTimeoutSeconds: number;
    ffmpegPath: string;
    silenceToken: string;
    nudgeOnEmpty: boolean;
    typingPrivate: boolean;
    typingGroup: boolean;
    typingCharsPerMinute: number;
    typingMinSeconds: number;
    typingMaxSeconds: number;
    groupMinGapSeconds: number;
    groupMaxPerWindow: number;
    groupWindowSeconds: number;
    sendMaxWaitSeconds: number;
    groupReplyMention: boolean;
    groupReplyQuote: boolean;
    segmentAdminPrivate: boolean;
    segmentPrivate: boolean;
    segmentGroup: boolean;
    segmentMax: number;
    segmentMaxSeconds: number;
    watchEnabled: boolean;
    watchIntervalMinutes: number;
    watchGraceMinutes: number;
    alertRepeatHours: number;
    alertOnRecover: boolean;
    mailEnabled: boolean;
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPass: string;
    mailTo: string;
    pushService: PushService;
    pushKey: string;
    ttsEnabled: boolean;
    ttsMode: TtsMode;
    ttsChance: number;
    ttsAdminPrivate: boolean;
    ttsPrivate: boolean;
    ttsGroup: boolean;
    ttsMaxChars: number;
    ttsAlsoText: boolean;
    ttsStripParens: boolean;
    ttsSpeed: number;
    breezeApiKey: string;
    breezeVoiceId: string;
    breezeModel: string;
    breezeLanguage: string;
    inworldApiKey: string;
    inworldVoiceId: string;
    inworldModel: string;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
}
/** 插件收到的配置：每项都是可实时读取的引用（.get()），设置页保存后立即更新。 */
export type LiveConfig = {
    [K in keyof Config]: {
        get(): Config[K];
    };
};
export declare const Config: z<LiveConfig>;
export declare const name = "dsh-napcat-bridge";
export declare const inject: string[];
/** 给其他插件（如记忆插件）用的服务：ctx.napcat */
export interface NapcatService {
    /** 是否允许消息存档；群必须在群名单内，管理员仅私聊豁免；关闭白名单时都允许。 */
    canArchive(session: MessageSession): boolean;
    adapter: AiocqhttpAdapter;
    /** 调用任意 OneBot API */
    callAction(action: string, params?: Record<string, unknown>): Promise<any>;
    /** 按会话主动发送（AstrBot send_by_session）；发出后也会发 'napcat/sent' */
    sendBySession(session: MessageSession, chain: MessageChain): Promise<void>;
    /** 已建立的会话 */
    sessions(): Array<{
        umo: string;
        sessionId: string;
    }>;
    masterPrivateBindings(): Array<{
        ownerId: string;
        prefix: string;
        sessionId: string;
        cwd: string;
    }>;
    restoreMasterPrivateBinding(ownerId: string, sessionId: string): Promise<void>;
    /** dsh 会话 id → 对应的 QQ 会话（私聊/群聊、QQ 号、群号、是不是主人私聊）；不是 QQ 会话时 undefined */
    sessionInfo(sessionId: string): SessionInfo | undefined;
    /** QQ 会话（unified_msg_origin）→ 当前的会话信息 */
    sessionInfoByUmo(umo: string): SessionInfo | undefined;
    /** 让某个 QQ 会话换一个新的 dsh 会话（旧的留在 dsh 里，下一条消息进新会话） */
    rotateSession(umo: string): Promise<{
        oldSessionId: string;
        newSessionId: string;
    }>;
    /** 图片、语音、视频 → 模型内容（按插件一的设置：语音转文字、视频抽帧、图片数量） */
    media: Media;
    /** 主动唤醒她：给这个 QQ 会话发一条内容，她一轮说完的回复照常发到 QQ（以「不发」暗号开头时不发） */
    wake(umo: string, content: ModelPart[] | string): Promise<{
        sessionId: string;
    }>;
}
declare module '@deepseek-ai/cordis' {
    interface Context {
        napcat: NapcatService;
    }
    interface Events {
        /** 每条转换好的 OneBot 消息/通知/请求；isWake 表示是否会交给模型 */
        'napcat/message'(abm: AstrBotMessage, event: AiocqhttpMessageEvent, isWake: boolean): void;
        /** 交给模型之前（serial）：监听者可以直接改 payload.content，往前后加文字或图片 */
        'napcat/prompt'(payload: PromptPayload): void | Promise<void>;
        /** 她发出了一条 QQ 消息 */
        'napcat/sent'(payload: SentPayload): void;
        /** QQ 会话换了新的 dsh 会话（/new、/reset 或 rotateSession） */
        'napcat/session-changed'(change: SessionChange): void;
    }
}
type Context = CordisContext & {
    agents: AgentRegistry;
    agentDefaultModel?: {
        currentSelection(): {
            provider: string;
            model: string;
            reasoningEffort?: string;
        } | undefined;
    };
    agentPresets?: {
        mount(agentCtx: unknown, id?: string): Promise<{
            id: string;
        }>;
    };
    sessionPersistence?: {
        stat(id: string): Promise<object | undefined>;
    };
};
export declare function apply(ctx: Context, live: LiveConfig): void;
export { MessageType };
