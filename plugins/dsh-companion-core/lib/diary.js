// 日记：她每天用第一人称写一篇（只写和主人的事，不写群里的），一天一个 Markdown 文件，永久保留；
// 每月再写一篇「月度总览」。主人的会话开新会话时，自动先给她看最近 30 天的日记和最近 12 个月的总览。
// 文件：<数据目录>/diary/2026-10-24.md、<数据目录>/diary/monthly/2026-10.md。
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { writeAtomic } from './docs.js';
const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_RE = /^(\d{4})-(\d{2})$/;
export class DiaryStore {
    dir;
    constructor(dir) {
        this.dir = dir;
    }
    dayPath(date) {
        if (!DAY_RE.test(date))
            throw new Error('日期格式不对：' + date);
        return join(this.dir, date + '.md');
    }
    monthPath(month) {
        if (!MONTH_RE.test(month))
            throw new Error('月份格式不对：' + month);
        return join(this.dir, 'monthly', month + '.md');
    }
    /** 所有日记的日期，新的在前。 */
    days() {
        if (!existsSync(this.dir))
            return [];
        return readdirSync(this.dir).filter(n => DAY_RE.test(n.replace(/\.md$/, '')) && n.endsWith('.md')).map(n => n.slice(0, -3)).sort().reverse();
    }
    /** 所有月度总览的月份，新的在前。 */
    months() {
        const d = join(this.dir, 'monthly');
        if (!existsSync(d))
            return [];
        return readdirSync(d).filter(n => MONTH_RE.test(n.replace(/\.md$/, '')) && n.endsWith('.md')).map(n => n.slice(0, -3)).sort().reverse();
    }
    readDay(date) {
        const p = this.dayPath(date);
        return existsSync(p) ? readFileSync(p, 'utf-8') : undefined;
    }
    readMonth(month) {
        const p = this.monthPath(month);
        return existsSync(p) ? readFileSync(p, 'utf-8') : undefined;
    }
    writeDay(date, text) {
        mkdirSync(this.dir, { recursive: true });
        writeAtomic(this.dayPath(date), text.trim() + '\n');
    }
    writeMonth(month, text) {
        mkdirSync(join(this.dir, 'monthly'), { recursive: true });
        writeAtomic(this.monthPath(month), text.trim() + '\n');
    }
    deleteDay(date) {
        const p = this.dayPath(date);
        if (!existsSync(p))
            return false;
        rmSync(p);
        return true;
    }
    deleteMonth(month) {
        const p = this.monthPath(month);
        if (!existsSync(p))
            return false;
        rmSync(p);
        return true;
    }
    /** 最近 n 天（按日期，不一定连续）的日记，旧的在前。 */
    recentDays(n, before) {
        const list = this.days().filter(d => before === undefined || d < before).slice(0, Math.max(0, n)).reverse();
        return list.map(date => ({ date, text: this.readDay(date) ?? '' }));
    }
    /** 最近 n 个月的总览，旧的在前。 */
    recentMonths(n, before) {
        const list = this.months().filter(m => before === undefined || m < before).slice(0, Math.max(0, n)).reverse();
        return list.map(date => ({ date, text: this.readMonth(date) ?? '' }));
    }
}
/** 一天按凌晨几点分界：比如分界 4 点，10 月 25 日 01:30 还算 10 月 24 日。返回 YYYY-MM-DD。 */
export function logicalDay(now, boundaryHour, timeZone) {
    const shifted = new Date(now - boundaryHour * 3_600_000);
    try {
        return new Intl.DateTimeFormat('sv-SE', { timeZone: timeZone || undefined, year: 'numeric', month: '2-digit', day: '2-digit' }).format(shifted);
    }
    catch {
        return shifted.toISOString().slice(0, 10);
    }
}
/** 当地时间的 HH:MM。 */
export function localClock(now, timeZone) {
    try {
        return new Intl.DateTimeFormat('en-GB', { timeZone: timeZone || undefined, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(now)).replace(/^24/, '00');
    }
    catch {
        return new Date(now).toISOString().slice(11, 16);
    }
}
/** 从文件名或正文里认出日期：2026-10-24、2026_10_24、20261024、2026年10月24日。 */
export function guessDate(name, text) {
    const tryOne = (s) => {
        let m = /(20\d{2})[-_.年/]?(\d{1,2})[-_.月/]?(\d{1,2})日?/.exec(s);
        if (m === null)
            return undefined;
        const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
        if (mo < 1 || mo > 12 || d < 1 || d > 31)
            return undefined;
        return y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    };
    return tryOne(name) ?? tryOne(text.slice(0, 200));
}
export function diaryPrompt(date, chat, memories, recent) {
    return [
        '你是一个陪伴型 AI。现在是一天结束的时候，请你用第一人称（"我"）给自己写一篇 ' + date + ' 的日记。',
        '',
        '要求：',
        '- 只写你和主人之间的事（下面的聊天记录都是你和主人的），不写群里的事。',
        '- 写成真实的日记：今天发生了什么、主人说了什么做了什么、他的心情、你的感受和想法、你们之间值得记住的瞬间、明天想做的事或答应过的事。',
        '- 用"我"指自己，用"主人"指他（或你平时叫他的称呼）。不要写成第三人称的记录或报告。',
        '- 300 到 800 字。第一行用 "# ' + date + '" 当标题。只输出日记正文。',
        recent.length > 0 ? '- 可以参考前几天的日记保持连贯，但不要重复抄。' : '',
        '',
        recent.length > 0 ? '前几天的日记：\n' + recent.map(e => e.text.trim()).join('\n\n') + '\n' : '',
        '今天写进记忆的事：',
        memories.length > 0 ? memories.map(m => '- ' + m).join('\n') : '（无）',
        '',
        '今天的聊天记录：',
        chat.join('\n'),
    ].filter(line => line !== '').join('\n');
}
export function monthPrompt(month, days) {
    return [
        '你是一个陪伴型 AI。下面是你 ' + month + ' 这个月写的日记。请你用第一人称（"我"）写一篇这个月的总结，留给以后的自己看。',
        '',
        '要求：这个月和主人之间发生的主要事情（按时间）、主人的变化（工作、生活、心情、身体）、新的约定和还没做完的事、对我来说最重要的几个瞬间。',
        '500 到 1000 字。第一行用 "# ' + month + ' 月度总览" 当标题。只输出正文。',
        '',
        ...days.map(d => d.text.trim()),
    ].join('\n');
}
/**
 * 开新会话时给她看的那一段：月度总览 + 最近的日记 + 上一个会话最后的内容。
 * 超过预算（字数）时，先把最早几天的日记缩成开头一段，还不够就去掉最早的。
 */
export function diaryBlock(months, days, carry, budgetChars) {
    if (months.length === 0 && days.length === 0 && carry.trim() === '')
        return '';
    const SHORT = 160;
    const dayTexts = days.map(d => ({ date: d.date, text: d.text.trim() }));
    const render = () => {
        const parts = ['<diary>', '下面是你自己写的日记和月度总览（不是别人给你的资料，是你亲身经历过的事），读完以后像平常一样接着和主人聊天，不用复述。'];
        if (months.length > 0)
            parts.push('', '## 月度总览', ...months.map(m => m.text.trim()));
        if (dayTexts.length > 0)
            parts.push('', '## 最近的日记', ...dayTexts.map(d => d.text));
        if (carry.trim() !== '')
            parts.push('', '## 上一个会话最后聊到的', carry.trim());
        parts.push('</diary>');
        return parts.join('\n');
    };
    let out = render();
    for (let i = 0; out.length > budgetChars && i < dayTexts.length; i++) {
        if (dayTexts[i].text.length > SHORT)
            dayTexts[i].text = dayTexts[i].text.slice(0, SHORT) + '……';
        out = render();
    }
    while (out.length > budgetChars && dayTexts.length > 0) {
        dayTexts.shift();
        out = render();
    }
    return out;
}
