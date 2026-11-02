import { type WebSocket } from 'ws';
import { type OneBotEvent } from './event.js';
export type Handler = (event: OneBotEvent) => unknown | Promise<unknown>;
export type Logger = (level: 'debug' | 'info' | 'warn' | 'error', message: string) => void;
export interface CQHttpOptions {
    /** AstrBot：ws_reverse_token（函数形式：每次握手时读取，设置页改了立即生效） */
    accessToken?: string | (() => string);
    /** AstrBot：api_timeout_sec=180 */
    apiTimeoutSec?: number;
    log: Logger;
}
/**
 * aiocqhttp.CQHttp（反向 WS）。NapCat 作为客户端连进来，
 * X-Client-Role 为 Universal / Event / API，X-Self-ID 为机器人 QQ 号。
 */
export declare class CQHttp {
    private readonly bus;
    private readonly accessToken;
    private readonly timeoutMs;
    private readonly log;
    /** _wsr_api_clients: self_id → ws */
    readonly apiClients: Map<string, WebSocket>;
    /** _wsr_event_clients */
    readonly eventClients: Set<WebSocket>;
    /** ResultStore._futures */
    private readonly futures;
    private readonly states;
    private http;
    /** 本插件新增：最近一次因 Token 被拒绝的连接 */
    lastRejected: {
        at: number;
        status: string;
        remote: string;
    } | undefined;
    private wss;
    constructor(options: CQHttpOptions);
    /** bot.on(*event_names) */
    on(...names: string[]): (func: Handler) => Handler;
    /** bot.on_message(*types) → message.{type} */
    onMessage(...types: string[]): (func: Handler) => Handler;
    /** bot.on_notice(*types) */
    onNotice(...types: string[]): (func: Handler) => Handler;
    /** bot.on_request(*types) */
    onRequest(...types: string[]): (func: Handler) => Handler;
    /** bot.on_websocket_connection → on_meta_event('lifecycle.connect') */
    onWebsocketConnection(func: Handler): Handler;
    /** bot.run_task(host, port)：启动服务器。 */
    run(host: string, port: number): Promise<void>;
    /** _handle_wsr 的鉴权部分：Authorization: Token|Bearer <token>，缺失 401，不符 403。 */
    private checkAuth;
    /** _handle_wsr：按 X-Client-Role 分为 event / api / universal。 */
    private handleWsr;
    /** ResultStore.add */
    private addResult;
    /** _handle_event */
    private handleEvent;
    /** _handle_event_with_response：处理函数返回 dict 时走 .handle_quick_operation_async。 */
    private handleEventWithResponse;
    /**
     * WebSocketReverseApi.call_action：
     * 指定 self_id 时用对应连接；否则在事件处理中用事件来源连接；否则只有一个连接时用它。
     * 返回 data 字段；status=failed 抛 ActionFailed；超时抛 NetworkError。
     */
    callAction(action: string, params?: Record<string, unknown>, eventWs?: WebSocket): Promise<any>;
    /** 本插件新增：是否正在监听 */
    get listening(): boolean;
    /** 本插件新增：当前连着的客户端（每条连接一项） */
    connections(): Array<{
        selfId: string;
        role: string;
        remote: string;
        since: number;
    }>;
    /** bot.send_private_msg(**params) */
    sendPrivateMsg(params: Record<string, unknown>): Promise<any>;
    /** bot.send_group_msg(**params) */
    sendGroupMsg(params: Record<string, unknown>): Promise<any>;
    /** bot.send(event, message)：向触发事件的主体发送（send_msg）。 */
    send(event: OneBotEvent, message: unknown): Promise<any>;
    /** 关闭所有反向 WS 连接（AstrBot _close_reverse_ws_connections）并停止服务器。 */
    close(): Promise<void>;
}
