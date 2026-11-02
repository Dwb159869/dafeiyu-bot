import type { Component } from './components.js';
export interface QuotedSettings {
    /** max_component_chain_depth */
    maxComponentChainDepth: number;
    /** max_forward_node_depth */
    maxForwardNodeDepth: number;
    /** max_forward_fetch */
    maxForwardFetch: number;
}
/** AstrBot 默认值（quoted_message_parser） */
export declare const QUOTED_DEFAULTS: QuotedSettings;
type CallAction = (action: string, params: Record<string, unknown>) => Promise<any>;
export interface QuotedContent {
    /** 交给模型的文字：<Quoted Message>(昵称): 内容</Quoted Message> */
    text: string;
    /** 引用里的图片地址（含聊天记录里的） */
    imageRefs: string[];
    /** 取聊天记录时出的错（给日志看） */
    errors?: string[];
}
/**
 * 整理消息里第一个引用（AstrBot 只处理第一个）：
 * 文字优先用转换时已取回的内容；只有"[转发消息]"占位时才调 get_msg 再展开聊天记录。
 */
export declare function extractQuoted(message: Component[], callAction: CallAction, s?: QuotedSettings): Promise<QuotedContent | null>;
/**
 * 本插件新增（AstrBot 不展开直接发来的聊天记录）：
 * 消息本身带的聊天记录（forward 段）同样展开，写成 <Forward Message>…</Forward Message>。
 * 先用 get_msg 取这条消息本身（NapCat 在 get_msg 里会把聊天记录的内容一起带上），
 * 没带内容再用 get_forward_msg 按 id 取。都取不到时把 NapCat 的原始返回写进 errors，方便查。
 */
export declare function extractForwards(message: Component[], callAction: CallAction, s?: QuotedSettings, messageId?: string | number): Promise<QuotedContent | null>;
export {};
