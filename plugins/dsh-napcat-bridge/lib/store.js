// 本插件新增：记住每个 QQ 会话当前用的 dsh 会话 id（/new、/reset 之后会换成新的）。
// 存在 <DSH_HOME>/napcat-bridge/sessions.json，原子写（先写临时文件再改名）。
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
export function defaultDataDir() {
    const home = process.env.DSH_HOME && process.env.DSH_HOME !== '' ? process.env.DSH_HOME : join(homedir(), '.dsh');
    return join(home, 'napcat-bridge');
}
export class SessionStore {
    file;
    map = {};
    constructor(file) {
        this.file = file;
        try {
            const parsed = JSON.parse(readFileSync(file, 'utf-8'));
            if (parsed !== null && typeof parsed === 'object')
                this.map = parsed;
        }
        catch {
            this.map = {};
        }
    }
    get(umo) {
        return this.map[umo];
    }
    set(umo, sessionId) {
        this.map[umo] = sessionId;
        mkdirSync(dirname(this.file), { recursive: true });
        const tmp = this.file + '.tmp';
        writeFileSync(tmp, JSON.stringify(this.map, null, 2));
        renameSync(tmp, this.file);
    }
}
