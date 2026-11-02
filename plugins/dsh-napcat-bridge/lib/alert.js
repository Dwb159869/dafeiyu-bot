// 本插件新增：掉线提醒发出去。小号掉线了就没法用 QQ 提醒，所以走别的渠道：
//   - 邮件：用你自己的邮箱发（SMTP，QQ 邮箱 / 163 / Outlook / Gmail 等，密码填邮箱的「授权码」）；
//   - 微信推送：Server酱（sct.ftqq.com，SendKey）或 PushPlus（pushplus.plus，token）。
// 密码和 Key 只在发的时候用，不打印、不写进日志。
import nodemailer from 'nodemailer';
const TIMEOUT_MS = 20_000;
export async function sendMail(s, m) {
    if (!s.host.trim() || !s.user.trim())
        throw new Error('还没填 SMTP 服务器或邮箱账号');
    if (!s.pass)
        throw new Error('还没填邮箱授权码');
    const transport = nodemailer.createTransport({
        host: s.host.trim(),
        port: s.port,
        // 465 是一连上就加密；587 / 25 先明文再升级（STARTTLS，要求必须升级成功）
        secure: s.port === 465,
        requireTLS: s.port !== 465,
        auth: { user: s.user.trim(), pass: s.pass },
        connectionTimeout: TIMEOUT_MS, greetingTimeout: TIMEOUT_MS, socketTimeout: TIMEOUT_MS,
    });
    try {
        await transport.sendMail({ from: s.user.trim(), to: s.to.trim() || s.user.trim(), subject: m.title, text: m.text });
    }
    finally {
        transport.close();
    }
}
/** Server酱：新版 SendKey（sctp 开头）走 https://<uid>.push.ft07.com，旧版走 sctapi.ftqq.com。 */
export function serverChanUrl(key) {
    const k = key.trim();
    const m = /^sctp(\d+)t/i.exec(k);
    return m ? 'https://' + m[1] + '.push.ft07.com/send/' + encodeURIComponent(k) + '.send' : 'https://sctapi.ftqq.com/' + encodeURIComponent(k) + '.send';
}
export async function sendPush(s, m, doFetch = fetch) {
    if (s.service === 'off')
        throw new Error('没有选微信推送服务');
    if (!s.key.trim())
        throw new Error('还没填 Key');
    const res = s.service === 'serverchan'
        ? await doFetch(serverChanUrl(s.key), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: m.title, desp: m.text }), signal: AbortSignal.timeout(TIMEOUT_MS) })
        : await doFetch('https://www.pushplus.plus/send', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: s.key.trim(), title: m.title, content: m.text, template: 'txt' }), signal: AbortSignal.timeout(TIMEOUT_MS) });
    let json = {};
    try {
        json = await res.json();
    }
    catch { /* 有的出错时不是 JSON */ }
    // Server酱成功 code 0；PushPlus 成功 code 200
    const ok = res.ok && (s.service === 'serverchan' ? json.code === 0 : json.code === 200);
    if (!ok)
        throw new Error('推送服务返回 HTTP ' + res.status + (json.message || json.msg ? '：' + (json.message || json.msg) : ''));
}
