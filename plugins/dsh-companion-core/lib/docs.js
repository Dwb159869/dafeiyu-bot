// 人格稿、核心记忆这类"一整段文字"的文件：每次读都检查修改时间（没变就用缓存），
// 写之前把旧版本存进 history/，只留最近几份。所有路径都在插件数据目录下，存相对路径，换机器不会断。
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
/** 插件数据目录：<DSH_HOME>/companion */
export function defaultDataDir() {
    const home = process.env.DSH_HOME && process.env.DSH_HOME !== '' ? process.env.DSH_HOME : join(homedir(), '.dsh');
    return join(home, 'companion');
}
/** 先写临时文件再改名，写到一半断电也不会把原文件弄坏。 */
export function writeAtomic(path, content) {
    const tmp = path + '.tmp-' + process.pid;
    writeFileSync(tmp, content);
    renameSync(tmp, path);
}
let seq = 0;
/** 一个带历史版本的文本文件。 */
export class TextDoc {
    path;
    historyDir;
    keep;
    cache;
    /**
     * @param path - 文件路径
     * @param historyDir - 历史版本目录
     * @param keep - 最多留几份历史（读的时候取当前值，设置页改了立即生效）
     */
    constructor(path, historyDir, keep) {
        this.path = path;
        this.historyDir = historyDir;
        this.keep = keep;
    }
    /** 当前内容；文件不存在时是空字符串。 */
    read() {
        let st;
        try {
            st = statSync(this.path);
        }
        catch {
            this.cache = undefined;
            return '';
        }
        if (this.cache !== undefined && this.cache.mtimeMs === st.mtimeMs && this.cache.size === st.size)
            return this.cache.text;
        const text = readFileSync(this.path, 'utf-8');
        this.cache = { mtimeMs: st.mtimeMs, size: st.size, text };
        return text;
    }
    /** 写入新内容；旧内容不同且不为空时先存成历史版本。返回存下的历史版本（没存时 undefined）。 */
    write(content, meta) {
        const old = this.read();
        if (old === content)
            return undefined;
        mkdirSync(join(this.path, '..'), { recursive: true });
        let saved;
        if (old.trim() !== '' && this.keep() > 0) {
            mkdirSync(this.historyDir, { recursive: true });
            const time = Date.now();
            // 同一毫秒里可能连存几份：带一个递增序号，按 id 排序也是先后顺序
            seq = (seq + 1) % 10000;
            const id = new Date(time).toISOString().replace(/[-:.]/g, '').replace('T', '-').replace('Z', '') + '-' + String(seq).padStart(4, '0') + Math.random().toString(36).slice(2, 5);
            saved = { id, time, by: meta.by, ...(meta.sessionId ? { sessionId: meta.sessionId } : {}), ...(meta.reason ? { reason: meta.reason } : {}), length: old.length };
            writeAtomic(join(this.historyDir, id + '.md'), old);
            writeAtomic(join(this.historyDir, id + '.json'), JSON.stringify(saved, null, 2));
        }
        writeAtomic(this.path, content);
        this.cache = undefined;
        this.prune();
        return saved;
    }
    /** 历史版本，最新的在前。 */
    history() {
        if (!existsSync(this.historyDir))
            return [];
        const out = [];
        for (const name of readdirSync(this.historyDir)) {
            if (!name.endsWith('.json'))
                continue;
            try {
                const v = JSON.parse(readFileSync(join(this.historyDir, name), 'utf-8'));
                if (typeof v.id === 'string' && existsSync(join(this.historyDir, v.id + '.md')))
                    out.push(v);
            }
            catch {
                // 坏掉的记录跳过
            }
        }
        return out.sort((a, b) => b.time - a.time || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
    }
    /** 读某个历史版本的内容。 */
    version(id) {
        if (!/^[\w-]+$/.test(id))
            return undefined;
        const path = join(this.historyDir, id + '.md');
        return existsSync(path) ? readFileSync(path, 'utf-8') : undefined;
    }
    /** 回退到某个历史版本（当前内容也会先存成历史）。 */
    restore(id) {
        const text = this.version(id);
        if (text === undefined)
            return false;
        const v = this.history().find(x => x.id === id);
        const when = v === undefined ? id : new Date(v.time).toLocaleString('zh-CN', { hour12: false });
        this.write(text, { by: 'restore', reason: '回退到 ' + when + ' 的版本' });
        return true;
    }
    /** 超过份数的旧版本删掉（只删本插件自己存的历史）。 */
    prune() {
        const keep = Math.max(0, this.keep());
        for (const v of this.history().slice(keep)) {
            rmSync(join(this.historyDir, v.id + '.md'), { force: true });
            rmSync(join(this.historyDir, v.id + '.json'), { force: true });
        }
    }
}
/** 在一段文字里把 oldText 换成 newText；oldText 为空表示追加到末尾。oldText 必须恰好出现一次。 */
export function applyEdit(current, oldText, newText) {
    if (oldText === '') {
        const sep = current === '' || current.endsWith('\n') ? '' : '\n';
        return { ok: true, text: current + sep + newText };
    }
    const first = current.indexOf(oldText);
    if (first < 0)
        return { ok: false, error: '没有找到要替换的原文（old_text），请先确认原文一字不差' };
    if (current.indexOf(oldText, first + 1) >= 0)
        return { ok: false, error: '要替换的原文出现了不止一次，请多带一点上下文让它唯一' };
    return { ok: true, text: current.slice(0, first) + newText + current.slice(first + oldText.length) };
}
