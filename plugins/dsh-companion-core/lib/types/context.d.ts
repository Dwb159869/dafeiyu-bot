import type { Context } from '@deepseek-ai/cordis';
export declare const name = "companion-context";
type AnyAgent = {
    session: any;
    options: {
        provider?: string;
        model?: string;
    };
};
declare const CompanionContextEngine_base: new (ctx: Context, config?: object) => any;
export declare class CompanionContextEngine extends CompanionContextEngine_base {
    /** 正在进行的处理用哪种方式（summarize 钩子里读）。 */
    private readonly pending;
    private service;
    private policy;
    private log;
    /** 这一段里人说的话和她的回复，给「处理之前」的监听者（记忆）用。 */
    private transcript;
    private notify;
    /** 处理一段：先通知，再交给 dsh 的压缩事务（summarize 里按 pending 决定截断还是写回忆）。 */
    private process;
    /** 上下文现在占模型上限的多少（0–1）；拿不到模型信息时 undefined。 */
    private pressure;
    compactIfNeeded(agent: AnyAgent, trigger: 'pressure' | 'context-overflow', signal: AbortSignal): Promise<unknown>;
    /** dsh 压缩事务调用的唯一钩子：截断时直接给一句话，LLM 压缩时用中文第一人称的指令。 */
    summarize(input: {
        messages: unknown[];
        tools?: unknown[];
    }, agent: AnyAgent, signal?: AbortSignal): Promise<unknown>;
}
export default CompanionContextEngine;
