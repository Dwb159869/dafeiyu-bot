/** 算"人说的话"的消息来源：dsh 里输入的（user）、QQ 来的（plugin:napcat-bridge）。其他（压缩摘要、运行信息、技能等）不算一轮。 */
export declare const HUMAN_SOURCES: Set<string>;
/** 只用到会话的这几样东西（真实的 dsh Session 都有）。 */
export interface SurfaceLike {
    surface: {
        nodes: readonly number[];
    };
    eventAt(seq: number): {
        type: string;
        data?: unknown;
    } | undefined;
}
export declare function isHumanTurn(event: {
    type: string;
    data?: unknown;
} | undefined): boolean;
/** 当前上下文里一共有几轮。 */
export declare function countRounds(session: SurfaceLike): number;
/**
 * 这一轮刚开始、人说的话还没放进上下文吗？dsh 在每一步发请求前检查要不要压缩（agent/pre-step），
 * 新一轮的第一步检查时，新消息还排在后面没进上下文。往回找日志：先碰到 turn/start 说明还没进来。
 */
export declare function pendingHumanTurn(session: SurfaceLike & {
    seq?: number;
}): boolean;
export interface DropRange {
    /** 第一个要处理的节点（含） */
    start: number;
    /** 最后一个要处理的节点（含） */
    end: number;
    /** 这次处理掉几轮 */
    rounds: number;
}
/**
 * 挑出最早的 drop 轮（至少留下最新的一轮），返回要截掉/压缩的节点范围。
 * 开头的系统消息不动；切口不能把工具调用和它的结果分开（balanced 判断切口是否完整）。
 * 上一次的压缩摘要在最前面，会一起被处理（LLM 压缩时合并进新摘要）。
 */
export declare function selectRounds(session: SurfaceLike, drop: number, balanced: (seq: number) => boolean): DropRange | null;
/** 截断时留在原处的一句话。 */
export declare function truncationNote(rounds: number): string;
/** LLM 压缩用的指令：中文、她的第一人称，作为最后一条用户消息接在被压缩的对话后面（能用上对话前缀的缓存）。 */
export declare const SUMMARY_INSTRUCTION: string;
