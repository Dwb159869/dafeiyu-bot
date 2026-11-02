import type { ContextRule, Scope } from './rules.js';
export interface ContextPolicy {
    scope: Scope;
    rule: ContextRule;
    /** 上下文到模型上限的百分之多少就处理 */
    thresholdPercent: number;
    /** 压缩用哪个模型（带思考等级；带 api 时直接调别家）；没有 = 用会话自己的 */
    summaryModel?: import('./extract.js').ModelTarget;
}
/** 截断或压缩之前发出的通知（阶段 2 的记忆在这里先把要紧内容写进记忆）。 */
export interface BeforeCompactPayload {
    sessionId: string;
    scope: Scope;
    mode: 'truncate' | 'llm';
    reason: 'rounds' | 'pressure' | 'overflow' | 'manual';
    /** 要处理掉的那几轮的文字（按时间顺序，[角色] 内容） */
    transcript: string[];
}
/**
 * 别的插件说「这是给谁的」：
 *   - sessionId：在某个 dsh 会话里（按插件二的规则判断是主人、别人私聊还是群聊）；
 *   - audience：不在会话里时直接说——'master' 能用主人的核心记忆和私密记忆，'public' 只用公开的（默认）。
 */
export interface CompanionTarget {
    sessionId?: string;
    audience?: 'master' | 'public';
}
export interface CompanionIdentity {
    /** 人格稿（设置页「人格」） */
    persona: string;
    /** 核心记忆（public 只有公开的那份；master 是公开 + 主人的） */
    core: string;
    /** 直接放进系统提示词的一段：人格 + 核心记忆（和她自己会话里的写法一样） */
    prompt: string;
    /** 实际用的是哪一档（权限不够时 master 会降成 public） */
    audience: 'master' | 'public';
}
export interface CompanionMemory {
    id: number;
    content: string;
    kind: string;
    importance: number;
    /** 和问题的相关程度 0–1 */
    relevance: number;
    createdAt: number;
}
export interface CompanionService {
    /** 这个会话该怎么管上下文；返回 undefined 表示这个会话不归插件二管（不生效的预设），按 dsh 自带的方式压缩 */
    contextPolicy(sessionId: string, presetId?: string): ContextPolicy | undefined;
    /** 处理之前先通知（出错不影响处理） */
    beforeCompact(payload: BeforeCompactPayload): Promise<void>;
    /** 记一条日志（设置页能看到最近的） */
    log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void;
    /** 给其他插件：她的人格和核心记忆。设置里关掉时抛错。 */
    identity(target?: CompanionTarget): CompanionIdentity;
    /** 给其他插件：和 query 相关的长期记忆（和她自己聊天时的召回一样：关键词 + 向量 + 关系网）。 */
    recall(query: string, options?: CompanionTarget & {
        topK?: number;
    }): Promise<CompanionMemory[]>;
    /** 给其他插件：一整段可以直接当系统提示词用的文字：人格 + 核心记忆 + （给了 query 时）相关记忆。 */
    prompt(options?: CompanionTarget & {
        query?: string;
        topK?: number;
    }): Promise<string>;
    /** 给其他插件：替她记一件事（比如「看了某个视频」）。写进 public 或 master 的记忆，可信度比她自己记的低一档。 */
    remember(content: string, options: {
        by: string;
        audience?: 'master' | 'public';
        kind?: string;
        importance?: number;
    }): Promise<{
        ok: boolean;
        id?: number;
        message: string;
    }>;
}
declare module '@deepseek-ai/cordis' {
    interface Context {
        companion: CompanionService;
    }
    interface Events {
        /** 截断或压缩上下文之前（serial，最多等 60 秒） */
        'companion/before-compact'(payload: BeforeCompactPayload): void | Promise<void>;
    }
}
