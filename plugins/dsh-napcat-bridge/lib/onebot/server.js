// 移植自 aiocqhttp（MIT）：CQHttp 的反向 WebSocket 部分 + api_impl.WebSocketReverseApi/ResultStore + bus.EventBus。
// 只保留 AstrBot 用到的 use_ws_reverse=True 路径（AstrBot 不配 api_root，HTTP API/HTTP 上报都不启用）。
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { ActionFailed, ApiNotAvailable, NetworkError } from './errors.js';
import { eventFromPayload, eventName } from './event.js';
/** CQHttp 反向 WS 的路由（strict_slashes=False，结尾斜杠也接受）。 */
const WS_PATHS = new Set(['/ws', '/ws/event', '/ws/api']);
/** aiocqhttp.bus.EventBus：按 a.b.c → a.b → a 逐级触发订阅者，返回各结果。 */
class EventBus {
    subscribers = new Map();
    subscribe(event, func) {
        const list = this.subscribers.get(event) ?? [];
        list.push(func);
        this.subscribers.set(event, list);
    }
    async emit(event, payload) {
        const results = [];
        let current = event;
        while (true) {
            const funcs = this.subscribers.get(current) ?? [];
            results.push(...await Promise.all(funcs.map(f => f(payload))));
            const dot = current.lastIndexOf('.');
            if (dot < 0)
                break;
            current = current.slice(0, dot);
        }
        return results;
    }
}
/** api_impl._SequenceGenerator */
let seqCounter = 0;
const nextSeq = () => {
    seqCounter += 1;
    return seqCounter;
};
/**
 * aiocqhttp.CQHttp（反向 WS）。NapCat 作为客户端连进来，
 * X-Client-Role 为 Universal / Event / API，X-Self-ID 为机器人 QQ 号。
 */
export class CQHttp {
    bus = new EventBus();
    accessToken;
    timeoutMs;
    log;
    /** _wsr_api_clients: self_id → ws */
    apiClients = new Map();
    /** _wsr_event_clients */
    eventClients = new Set();
    /** ResultStore._futures */
    futures = new Map();
    states = new WeakMap();
    http;
    /** 本插件新增：最近一次因 Token 被拒绝的连接 */
    lastRejected;
    wss;
    constructor(options) {
        const token = options.accessToken ?? '';
        this.accessToken = typeof token === 'function' ? token : () => token;
        this.timeoutMs = (options.apiTimeoutSec ?? 180) * 1000;
        this.log = options.log;
    }
    /** bot.on(*event_names) */
    on(...names) {
        return (func) => {
            for (const name of names)
                this.bus.subscribe(name, func);
            return func;
        };
    }
    /** bot.on_message(*types) → message.{type} */
    onMessage(...types) {
        return this.on(...(types.length > 0 ? types.map(t => 'message.' + t) : ['message']));
    }
    /** bot.on_notice(*types) */
    onNotice(...types) {
        return this.on(...(types.length > 0 ? types.map(t => 'notice.' + t) : ['notice']));
    }
    /** bot.on_request(*types) */
    onRequest(...types) {
        return this.on(...(types.length > 0 ? types.map(t => 'request.' + t) : ['request']));
    }
    /** bot.on_websocket_connection → on_meta_event('lifecycle.connect') */
    onWebsocketConnection(func) {
        return this.on('meta_event.lifecycle.connect')(func);
    }
    /** bot.run_task(host, port)：启动服务器。 */
    async run(host, port) {
        const http = createServer((_req, res) => {
            // AstrBot 只启用反向 WS；HTTP 上报路由（POST /）在没有 api_root/secret 时也存在，
            // 但 AstrBot 场景下 NapCat 只走 WS，这里对普通 HTTP 请求返回 404。
            res.statusCode = 404;
            res.end();
        });
        const wss = new WebSocketServer({ noServer: true });
        http.on('upgrade', (req, socket, head) => {
            const path = (req.url ?? '').split('?')[0].replace(/\/+$/, '') || '/';
            if (!WS_PATHS.has(path)) {
                socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
                socket.destroy();
                return;
            }
            const denied = this.checkAuth(req);
            if (denied !== undefined) {
                // 本插件新增：记下最近一次被拒绝的连接，设置页「测试连接」用来提示 Token 不对
                this.lastRejected = { at: Date.now(), status: denied, remote: String(req.socket.remoteAddress ?? '') };
                socket.write('HTTP/1.1 ' + denied + '\r\n\r\n');
                socket.destroy();
                return;
            }
            wss.handleUpgrade(req, socket, head, ws => this.handleWsr(ws, req));
        });
        await new Promise((resolve, reject) => {
            http.once('error', reject);
            http.listen(port, host, () => {
                http.off('error', reject);
                resolve();
            });
        });
        this.http = http;
        this.wss = wss;
    }
    /** _handle_wsr 的鉴权部分：Authorization: Token|Bearer <token>，缺失 401，不符 403。 */
    checkAuth(req) {
        const accessToken = this.accessToken();
        if (accessToken === '')
            return undefined;
        const auth = String(req.headers.authorization ?? '');
        const m = /^(?:[Tt]oken|[Bb]earer) (\S+)$/.exec(auth);
        if (m === null) {
            this.log('warn', 'authorization header is missed');
            return '401 Unauthorized';
        }
        if (m[1].trim() !== accessToken) {
            this.log('warn', 'authorization header is invalid');
            return '403 Forbidden';
        }
        return undefined;
    }
    /** _handle_wsr：按 X-Client-Role 分为 event / api / universal。 */
    handleWsr(ws, req) {
        const role = String(req.headers['x-client-role'] ?? '').toLowerCase();
        const selfId = String(req.headers['x-self-id'] ?? '');
        const state = {
            selfId,
            role,
            remote: String(req.socket.remoteAddress ?? ''),
            since: Date.now(),
            isApi: role === 'api' || role === 'universal',
            isEvent: role === 'event' || role === 'universal',
        };
        if (!state.isApi && !state.isEvent) {
            ws.close();
            return;
        }
        this.states.set(ws, state);
        if (state.isApi)
            this.apiClients.set(selfId, ws);
        if (state.isEvent)
            this.eventClients.add(ws);
        ws.on('message', data => {
            let payload;
            try {
                payload = JSON.parse(data.toString());
            }
            catch {
                payload = null;
            }
            if (role === 'api') {
                // _handle_wsr_api：全部当 API 结果
                if (payload !== null && typeof payload === 'object')
                    this.addResult(payload);
                return;
            }
            if (payload === null || typeof payload !== 'object' || Array.isArray(payload))
                return;
            const obj = payload;
            if (role === 'event' || 'post_type' in obj) {
                void this.handleEventWithResponse(obj, ws);
            }
            else if (Object.keys(obj).length > 0) {
                this.addResult(obj);
            }
        });
        ws.on('close', () => {
            if (state.isEvent)
                this.eventClients.delete(ws);
            // 允许通配连接（self_id 可能是 '*'），先检查存在再删除
            if (state.isApi && this.apiClients.get(selfId) === ws)
                this.apiClients.delete(selfId);
        });
        ws.on('error', error => this.log('warn', 'websocket error: ' + error.message));
    }
    /** ResultStore.add */
    addResult(result) {
        const echo = result.echo;
        if (echo !== null && typeof echo === 'object' && Number.isInteger(echo.seq)) {
            const pending = this.futures.get(echo.seq);
            if (pending !== undefined)
                pending.resolve(result);
        }
    }
    /** _handle_event */
    async handleEvent(payload) {
        const ev = eventFromPayload(payload);
        if (ev === null)
            return undefined;
        const name = eventName(ev);
        this.log('debug', 'received event: ' + name);
        const results = (await this.bus.emit(name, ev)).filter(r => r !== undefined && r !== null);
        return results.length > 0 ? results[0] : undefined;
    }
    /** _handle_event_with_response：处理函数返回 dict 时走 .handle_quick_operation_async。 */
    async handleEventWithResponse(payload, ws) {
        let response;
        try {
            response = await this.handleEvent(payload);
        }
        catch (error) {
            this.log('error', 'event handler failed: ' + (error instanceof Error ? error.message : String(error)));
            return;
        }
        if (response !== null && typeof response === 'object' && !Array.isArray(response)) {
            const context = { ...payload };
            delete context.message;
            delete context.raw_message;
            delete context.comment;
            delete context.sender;
            try {
                await this.callAction('.handle_quick_operation_async', { self_id: payload.self_id, context, operation: response }, ws);
            }
            catch {
                // aiocqhttp 吞掉 Error
            }
        }
    }
    /**
     * WebSocketReverseApi.call_action：
     * 指定 self_id 时用对应连接；否则在事件处理中用事件来源连接；否则只有一个连接时用它。
     * 返回 data 字段；status=failed 抛 ActionFailed；超时抛 NetworkError。
     */
    async callAction(action, params = {}, eventWs) {
        let apiWs;
        if (params.self_id !== undefined && params.self_id !== null && params.self_id !== '') {
            apiWs = this.apiClients.get(String(params.self_id));
        }
        else if (eventWs !== undefined && this.eventClients.has(eventWs)) {
            const state = this.states.get(eventWs);
            if (state !== undefined)
                apiWs = this.apiClients.get(state.selfId);
        }
        else if (this.apiClients.size === 1) {
            apiWs = this.apiClients.values().next().value;
        }
        if (apiWs === undefined)
            throw new ApiNotAvailable();
        const seq = nextSeq();
        const result = await new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.futures.delete(seq);
                reject(new NetworkError('WebSocket API call timeout'));
            }, this.timeoutMs);
            this.futures.set(seq, {
                resolve: value => {
                    clearTimeout(timer);
                    this.futures.delete(seq);
                    resolve(value);
                },
                timer,
            });
            apiWs.send(JSON.stringify({ action, params, echo: { seq } }), error => {
                if (error) {
                    clearTimeout(timer);
                    this.futures.delete(seq);
                    reject(new NetworkError(error.message));
                }
            });
        });
        // _handle_api_result
        if (result.status === 'failed')
            throw new ActionFailed(result);
        return result.data;
    }
    /** 本插件新增：是否正在监听 */
    get listening() {
        return this.http?.listening === true;
    }
    /** 本插件新增：当前连着的客户端（每条连接一项） */
    connections() {
        const all = new Set([...this.apiClients.values(), ...this.eventClients]);
        return [...all].map(ws => this.states.get(ws)).filter((x) => x !== undefined)
            .map(st => ({ selfId: st.selfId, role: st.role, remote: st.remote, since: st.since }));
    }
    /** bot.send_private_msg(**params) */
    sendPrivateMsg(params) {
        return this.callAction('send_private_msg', params);
    }
    /** bot.send_group_msg(**params) */
    sendGroupMsg(params) {
        return this.callAction('send_group_msg', params);
    }
    /** bot.send(event, message)：向触发事件的主体发送（send_msg）。 */
    send(event, message) {
        const params = {};
        for (const key of ['message_type', 'user_id', 'group_id', 'discuss_id']) {
            if (key in event)
                params[key] = event[key];
        }
        params.message = message;
        if (!('message_type' in params)) {
            if ('group_id' in params)
                params.message_type = 'group';
            else if ('discuss_id' in params)
                params.message_type = 'discuss';
            else if ('user_id' in params)
                params.message_type = 'private';
        }
        if (event.self_id !== undefined)
            params.self_id = event.self_id;
        return this.callAction('send_msg', params);
    }
    /** 关闭所有反向 WS 连接（AstrBot _close_reverse_ws_connections）并停止服务器。 */
    async close() {
        const clients = new Set([...this.apiClients.values(), ...this.eventClients]);
        for (const ws of clients) {
            try {
                ws.close(1000, 'Adapter shutdown');
            }
            catch {
                // 忽略
            }
        }
        this.apiClients.clear();
        this.eventClients.clear();
        for (const [seq, pending] of this.futures) {
            clearTimeout(pending.timer);
            this.futures.delete(seq);
        }
        this.wss?.close();
        await new Promise(resolve => {
            if (this.http === undefined)
                return resolve();
            this.http.close(() => resolve());
            this.http.closeAllConnections?.();
        });
        this.http = undefined;
        this.wss = undefined;
    }
}
