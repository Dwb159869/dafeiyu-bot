// 移植自 aiocqhttp/exceptions.py（MIT）。
/** aiocqhttp.exceptions.Error */
export class OneBotError extends Error {
}
/** aiocqhttp.exceptions.ApiNotAvailable：没有可用的 API 连接。 */
export class ApiNotAvailable extends OneBotError {
    constructor() {
        super('ApiNotAvailable');
        this.name = 'ApiNotAvailable';
    }
}
/** aiocqhttp.exceptions.NetworkError：调用超时或连接问题。 */
export class NetworkError extends OneBotError {
    constructor(message) {
        super(message);
        this.name = 'NetworkError';
    }
}
/** aiocqhttp.exceptions.ActionFailed：OneBot 返回 status = failed。 */
export class ActionFailed extends OneBotError {
    result;
    retcode;
    constructor(result) {
        super('ActionFailed(' + JSON.stringify(result) + ')');
        this.name = 'ActionFailed';
        this.result = result;
        this.retcode = result.retcode;
    }
}
