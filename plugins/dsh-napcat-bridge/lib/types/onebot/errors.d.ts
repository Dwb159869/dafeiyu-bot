/** aiocqhttp.exceptions.Error */
export declare class OneBotError extends Error {
}
/** aiocqhttp.exceptions.ApiNotAvailable：没有可用的 API 连接。 */
export declare class ApiNotAvailable extends OneBotError {
    constructor();
}
/** aiocqhttp.exceptions.NetworkError：调用超时或连接问题。 */
export declare class NetworkError extends OneBotError {
    constructor(message: string);
}
/** aiocqhttp.exceptions.ActionFailed：OneBot 返回 status = failed。 */
export declare class ActionFailed extends OneBotError {
    readonly result: Record<string, unknown>;
    readonly retcode: unknown;
    constructor(result: Record<string, unknown>);
}
