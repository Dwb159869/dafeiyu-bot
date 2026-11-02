// 主人 QQ 私聊的 dsh 逻辑事件日志。通过宿主读写接口处理，不复制活动日志或其他人的会话目录。
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const filename = 'master-sessions.json';
const belongs = (id, prefix) => id === prefix || id.startsWith(prefix + '-');
const keyOf = (ref) => ref.attachmentId + ':' + (ref.mediaType ?? 'file') + ':' + (ref.name ?? '');
function refsIn(value, out = new Map()) {
    if (!value || typeof value !== 'object')
        return out;
    const ref = value;
    if (typeof ref.attachmentId === 'string' && typeof ref.bytes === 'number')
        out.set(keyOf(ref), ref);
    else
        for (const v of Object.values(value))
            refsIn(v, out);
    return out;
}
function requireServices(s) {
    if (!s.bridge?.masterPrivateBindings || !s.bridge?.restoreMasterPrivateBinding || !s.persistence)
        throw new Error('主人会话备份需要新版 QQ 桥接插件及 dsh 会话存储服务');
}
export async function exportMasterSessions(dir, services) {
    requireServices(services);
    const { bridge, persistence, attachments } = services;
    const bindings = bridge.masterPrivateBindings();
    await persistence.flush();
    const bundle = { version: 1, sessions: [], attachments: [] };
    for (const { header } of await persistence.list()) {
        const b = bindings.find(b => belongs(String(header.id), b.prefix));
        if (!b)
            continue;
        const handle = await persistence.open(String(header.id), 'read');
        try {
            const { events } = await handle.read();
            bundle.sessions.push({ archived: services.workspaces?.archivedSessionIds.includes(String(header.id)) ?? false, ownerId: b.ownerId, prefix: b.prefix, current: String(header.id) === b.sessionId, header: handle.header, inheritedEventCount: handle.inheritedEventCount, events });
        }
        finally {
            await handle.close();
        }
    }
    for (const ref of refsIn(bundle.sessions).values()) {
        if (!attachments)
            throw new Error('会话含附件，但宿主附件服务不可用');
        let data;
        if (ref.mediaType)
            data = Buffer.from((await attachments.readImage(ref)).data);
        else {
            const chunks = [];
            for await (const chunk of attachments.readFileStream(ref))
                chunks.push(chunk);
            data = Buffer.concat(chunks);
        }
        bundle.attachments.push({ ref, data: data.toString('base64') });
    }
    writeFileSync(join(dir, filename), JSON.stringify(bundle), { mode: 0o600 });
    return bundle.sessions.length;
}
export async function importMasterSessions(dir, services) {
    requireServices(services);
    const bundle = JSON.parse(readFileSync(join(dir, filename), 'utf8'));
    if (bundle.version !== 1 || !Array.isArray(bundle.sessions) || !Array.isArray(bundle.attachments))
        throw new Error('主人会话备份格式不正确');
    const bindings = services.bridge.masterPrivateBindings();
    // 整包先检查，不能把旧管理员或群聊接到当前私聊，也不能导入没有声明归属的日志。
    const selected = bundle.sessions.map(s => {
        const b = bindings.find(b => b.ownerId === s.ownerId);
        if (!b || !belongs(String(s.header.id), s.prefix) || !s.prefix.endsWith('-FriendMessage-' + s.ownerId) || !Array.isArray(s.events))
            throw new Error('备份会话不属于当前主人私聊');
        return { s, b };
    });
    if (new Set(selected.map(({ s }) => String(s.header.id))).size !== selected.length)
        throw new Error('备份会话 ID 重复');
    if (bindings.some(b => selected.filter(({ s }) => s.ownerId === b.ownerId && s.current).length > 1))
        throw new Error('主人会话映射重复');
    const refs = refsIn(bundle.sessions);
    for (const a of bundle.attachments) {
        if (!refs.has(keyOf(a.ref)))
            throw new Error('备份包含未被主人会话引用的附件');
        if (!services.attachments)
            throw new Error('宿主附件服务不可用');
        const data = Buffer.from(a.data, 'base64');
        const saved = a.ref.mediaType
            ? await services.attachments.saveImage({ data, mediaType: a.ref.mediaType, name: a.ref.name })
            : await services.attachments.saveFile({ data, name: a.ref.name });
        if (saved.attachmentId !== a.ref.attachmentId || saved.bytes !== a.ref.bytes)
            throw new Error('恢复附件校验失败');
        refs.delete(keyOf(a.ref));
    }
    if (refs.size)
        throw new Error('主人会话备份缺少附件');
    const ids = new Map();
    for (const { s, b } of selected)
        ids.set(String(s.header.id), (b.prefix + '-import-' + randomUUID()));
    const current = [];
    for (const { s, b } of selected) {
        const id = ids.get(String(s.header.id));
        const header = { ...s.header, id, cwd: b.cwd, ...(s.header.parentSession ? { parentSession: ids.get(String(s.header.parentSession)) ?? s.header.parentSession } : {}) };
        const handle = await services.persistence.create(header, { inheritedEventCount: s.inheritedEventCount });
        // dsh 的交付标记绑定日志所属会话；仅迁移宿主字段，不替换聊天正文中的字符串。
        const events = s.events.map(event => {
            const stored = event;
            if (stored.type !== 'session-log-deepseek/delivery-accepted')
                return event;
            const data = stored.data;
            const target = ids.get(String(data.sessionId));
            return target ? { ...stored, data: { ...data, sessionId: target } } : event;
        });
        try {
            await handle.append(events);
            await handle.flush();
        }
        finally {
            await handle.close();
        }
        const check = await services.persistence.open(String(id), 'read');
        try {
            await check.read();
        }
        finally {
            await check.close();
        }
        const workspace = await services.workspaces?.resolveByPath(b.cwd);
        await workspace?.attachSession(String(id));
        if (s.archived && !s.current)
            await services.workspaces?.archiveSession(String(id));
        if (s.current)
            current.push({ ownerId: b.ownerId, id: String(id) });
    }
    for (const c of current)
        await services.bridge.restoreMasterPrivateBinding(c.ownerId, c.id);
}
