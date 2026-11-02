/** 插件一（dsh-napcat-bridge ≥ 0.6.0）给的会话信息；这里只声明用到的字段，不依赖插件一的代码。 */
export interface NapcatSessionInfo {
    umo: string;
    sessionId: string;
    type: 'private' | 'group';
    userId?: string;
    groupId?: string;
    adminPrivate: boolean;
}
export interface ArchiveSession {
    platform_name: string;
    message_type: string;
    session_id: string;
}
/** 本插件新增：缺少新版 bridge 权限接口时停止 QQ 存档，不能回退为默认放行。 */
export declare function archiveAllowed(napcat: NapcatLike | undefined, session: ArchiveSession | undefined): boolean;
export interface NapcatLike {
    canArchive?(session: ArchiveSession): boolean;
    sessionInfo?(sessionId: string): NapcatSessionInfo | undefined;
}
export type Category = 'master' | 'private' | 'group';
export interface Scope {
    category: Category;
    /** 是不是 QQ 会话（插件一建的）；dsh 里直接开的会话为 false */
    qq: boolean;
    /** 私聊对方 / 群里每人单独会话时的这个人 */
    userId?: string;
    groupId?: string;
    /** unified_msg_origin（QQ 会话才有） */
    umo?: string;
}
/**
 * 判断一个 dsh 会话属于谁。
 * - 插件一登记过的 QQ 会话：主人私聊 → master，其他私聊 → private，群 → group。
 * - 插件一没登记、但 id 像 QQ 会话（napcat- 开头，比如在 dsh 网页里打开了一个 QQ 会话）：
 *   按 id 里的消息类型归到 group / private，**不当成主人**（里面是别人说的话）。
 * - 其他：dsh 里直接开的会话，只有主人能打开 dsh，算 master。
 */
export declare function scopeOf(sessionId: string, napcat?: NapcatLike): Scope;
export type ContextMode = 'truncate' | 'llm';
export interface ContextRule {
    /** 最多保留多少轮；0 = 不按轮数限制 */
    maxRounds: number;
    /** 超过以后一次处理几轮 */
    dropRounds: number;
    mode: ContextMode;
}
export interface ArchiveRule {
    /** 保留多少天（阶段 3 起按它删除） */
    days: number;
    /** 保存没唤醒她的群消息 */
    unwoken: boolean;
}
/** 例外规则的一行（设置页的表格）。空着的项用默认值。 */
export interface RuleRow {
    /** QQ 号或群号 */
    target: string;
    kind: 'user' | 'group';
    maxRounds?: number;
    dropRounds?: number;
    mode?: ContextMode | '';
    archiveDays?: number;
    archiveUnwoken?: 'on' | 'off' | '';
    /** 遗忘方式：normal 普通遗忘（可恢复）、purge 直接彻底遗忘 */
    forgetMode?: 'normal' | 'purge' | '';
    /** 主动聊天：on 开、off 关、空用默认 */
    proactive?: 'on' | 'off' | '';
    note?: string;
}
export type ForgetMode = 'normal' | 'purge';
export interface RuleDefaults {
    context: Record<Category, ContextRule>;
    archive: Record<Category, ArchiveRule>;
    forget: Record<Category, ForgetMode>;
}
/** 这个会话命中的例外规则：群会话按群号，私聊（含主人）按对方 QQ 号。 */
export declare function matchRule(scope: Scope, rows: readonly RuleRow[]): RuleRow | undefined;
export declare function contextRule(scope: Scope, defaults: RuleDefaults, rows: readonly RuleRow[]): ContextRule;
export declare function archiveRule(scope: Scope, defaults: RuleDefaults, rows: readonly RuleRow[]): ArchiveRule;
/** 这个会话的遗忘方式：默认主人普通遗忘、其他直接彻底遗忘，例外规则可改。 */
export declare function forgetMode(scope: Scope, defaults: RuleDefaults, rows: readonly RuleRow[]): ForgetMode;
