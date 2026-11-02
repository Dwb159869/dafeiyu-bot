export interface MailSettings {
    enabled: boolean;
    host: string;
    port: number;
    user: string;
    pass: string;
    /** 收件人；空 = 发给自己（user） */
    to: string;
}
export type PushService = 'off' | 'serverchan' | 'pushplus';
export interface PushSettings {
    service: PushService;
    key: string;
}
export interface AlertMessage {
    title: string;
    text: string;
}
export declare function sendMail(s: MailSettings, m: AlertMessage): Promise<void>;
/** Server酱：新版 SendKey（sctp 开头）走 https://<uid>.push.ft07.com，旧版走 sctapi.ftqq.com。 */
export declare function serverChanUrl(key: string): string;
export declare function sendPush(s: PushSettings, m: AlertMessage, doFetch?: typeof fetch): Promise<void>;
