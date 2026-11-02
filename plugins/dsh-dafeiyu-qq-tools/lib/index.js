console.log('[dafeiyu-qq-tools] module loaded');
// 大肥鱼 QQ 资料与空间工具（DSH 版）
// 对应 AstrBot 的 dafeiyu_signature / qqprofile / qzone 三个插件：改资料与签名、发说说、改群名片。
import fs from 'node:fs';
import path from 'node:path';
import { defineTool } from '@deepseek-ai/dsh-tools';
import z from '@deepseek-ai/schemastery';
import { canSudoWithoutPassword, describeResult, logAdminCall, readSudoPassword, runShell } from './admin.js';

export const name = 'dafeiyu-qq-tools';
export const inject = ['tools', 'napcat'];

export const Config = z.object({
  owners: z.array(z.string()).default([]).description('主人 QQ 号'),
  reportRoot: z.string().default('/workspace/vault').description('错误报告写到哪里（小窝根目录）'),
  reportErrors: z.boolean().default(true).description('失败时自动写错误报告'),
  sudoFile: z.string().default('/home/example/.dsh/secrets/sudo.pass').description('管理员密码文件（600 权限）'),
  adminLog: z.string().default('').description('系统级调用日志，留空则写在小窝 04工作区/管理员日志.jsonl'),
});

const RESULT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ok: { type: 'boolean', required: true },
    message: { type: 'string', required: true },
  },
};
const render = (_args, value) => [{ type: 'text', text: String(value.message ?? '') }];
const sessionOf = (exec) => String(exec?.agent?.session?.id ?? '');
const errText = (e) => (e instanceof Error ? e.message : String(e));
// 工具里没有事件上下文，callAction 无法自动定位客户端；显式带上 self_id，避免多客户端接入时 ApiNotAvailable。
const selfIdArg = (b) => {
  const id = b?.selfId?.();
  return id === undefined || id === null || id === '' ? {} : { self_id: String(id) };
};

// ugc_right：1 公开、4 仅自己、16 部分好友、128 指定人可见（NapCat 允许值）
const VISIBILITY = { public: 1, private: 4, friends: 16, custom: 128 };

export function apply(ctx, config) {
  console.log('[dafeiyu-qq-tools] apply start');
  const log = (level, text) => {
    try {
      ctx.logger(level)('[dafeiyu-qq-tools] ' + text);
    } catch {
      /* 日志失败不影响工具 */
    }
  };
  const bridge = () => ctx.get('napcat');
  const isOwner = (sessionId) => {
    const umo = String(bridge()?.sessionInfo?.(sessionId)?.umo ?? '');
    const parts = umo.split(':');
    if (parts.length < 3) return false;
    return parts[1] === 'FriendMessage' && config.owners.includes(parts.slice(2).join(':'));
  };
  const guard = (sessionId) => {
    if (!isOwner(sessionId)) throw new Error('QQ 资料和空间工具只允许主人在私聊里用。');
    const b = bridge();
    if (b?.callAction === undefined) throw new Error('QQ 桥接现在没接上，改不了。');
    return b;
  };

  const action = async (sessionId, name, params) => {
    const b = guard(sessionId);
    try {
      return await b.callAction(name, { ...selfIdArg(b), ...(params ?? {}) });
    } catch (e) {
      throw new Error(name + ' 失败：' + errText(e));
    }
  };

  // 失败自动落错误报告（与 dafeiyu-vault 一致的位置与命名），报告写入失败不能影响工具本身。
  const redact = (text) =>
    String(text ?? '')
      .replace(/sk-[A-Za-z0-9_-]{8,}/g, 'sk-***')
      .replace(/(Bearer\s+)[A-Za-z0-9._-]{8,}/gi, '$1***')
      .replace(
        /((?:password|passwd|api_key|secret|token|jwt_secret|authorization)\s*["']?\s*[:=]\s*["']?)[^\s"',}]+/gi,
        '$1***',
      )
      .replace(/\b1[3-9]\d{9}\b/g, '1**********');
  const writeReport = (toolName, message, args) => {
    if (config.reportErrors === false) return;
    try {
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      const clock = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      const dir = path.join(config.reportRoot, '04工作区', '错误报告');
      fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, `${date}_${toolName}_${clock}.md`);
      let printed = '{}';
      try {
        printed = JSON.stringify(args ?? {}, null, 2).slice(0, 4000);
      } catch {
        printed = '（参数无法序列化）';
      }
      const body = [
        `# ${toolName} 调用失败`,
        '',
        `- 时间：${date} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
        `- 工具：${toolName}`,
        `- 现象：${redact(message)}`,
        '',
        '## 调用参数',
        '```json',
        redact(printed),
        '```',
        '',
        '## 处理建议',
        '- 先确认 QQ 桥接在线（6199 端口、NapCat 已登录），再重试一次。',
        '- 同一错误 30 分钟内再次出现会追加在下方。',
        '',
        '## 重复记录',
        '',
      ].join('\n');
      fs.writeFileSync(file, body, 'utf8');
    } catch {
      /* 报告失败不影响主流程 */
    }
  };
  const wrap = (def) => ({
    ...def,
    async execute(args, exec) {
      try {
        const value = await def.execute(args, exec);
        if (value && value.ok === false && /ApiNotAvailable|未连接|不可用/.test(String(value.message ?? ''))) {
          writeReport(def.name, String(value.message ?? ''), args);
        }
        return value;
      } catch (e) {
        writeReport(def.name, errText(e), args);
        return { ok: false, message: errText(e) + '（已记进错误报告）' };
      }
    },
  });

  const signature = defineTool({
    name: 'qq_signature',
    description: '改自己 QQ 的个性签名（text 传一句话，别太长）。',
    parameters: { text: { type: 'string', required: true, description: '新的个性签名' } },
    output: { schema: RESULT, render },
    async execute(args, exec) {
      const text = String(args.text ?? '').trim();
      if (text === '') return { ok: false, message: '签名不能是空的。' };
      if (text.length > 60) return { ok: false, message: '签名太长了，60 字以内。' };
      await action(sessionOf(exec), 'set_self_longnick', { longNick: text });
      return { ok: true, message: '签名改成「' + text + '」了。' };
    },
  });

  const profile = defineTool({
    name: 'qq_profile',
    description: '改自己 QQ 的昵称（nickname）或资料里的个性签名（personalNote），两个至少给一个。',
    parameters: {
      nickname: { type: 'string', description: '新昵称' },
      personalNote: { type: 'string', description: '资料个性签名' },
    },
    output: { schema: RESULT, render },
    async execute(args, exec) {
      const params = {};
      if (typeof args.nickname === 'string' && args.nickname.trim() !== '') params.nickname = args.nickname.trim();
      if (typeof args.personalNote === 'string' && args.personalNote.trim() !== '') params.personal_note = args.personalNote.trim();
      if (Object.keys(params).length === 0) return { ok: false, message: '昵称和签名都没给，改什么呢。' };
      await action(sessionOf(exec), 'set_qq_profile', params);
      return { ok: true, message: '资料改好了：' + JSON.stringify(params) };
    },
  });

  const qzonePost = defineTool({
    name: 'qzone_post',
    description: '发一条 QQ 空间说说。content 是正文；images 可以给 0~9 张本机绝对路径的图片；visibility 可选 public/private/friends，默认 public。',
    parameters: {
      content: { type: 'string', required: true, description: '说说正文' },
      images: { type: 'array', description: '本机图片绝对路径列表' },
      visibility: { type: 'string', enum: ['public', 'private', 'friends'], description: '可见范围，默认 public' },
    },
    output: { schema: RESULT, render },
    async execute(args, exec) {
      const content = String(args.content ?? '').trim();
      if (content === '') return { ok: false, message: '说说正文不能是空的。' };
      const images = Array.isArray(args.images) ? args.images.map((x) => String(x)).filter((x) => path.isAbsolute(x)).slice(0, 9) : [];
      const params = { content, ugc_right: VISIBILITY[String(args.visibility ?? 'public')] ?? 1 };
      if (images.length > 0) params.images = images;
      const result = await action(sessionOf(exec), 'send_qzone_msg', params);
      const tid = result?.data?.tid ?? result?.tid;
      return { ok: true, message: '说说发出去了' + (tid ? '（tid ' + tid + '）' : '') + '。' };
    },
  });

  const qzoneDelete = defineTool({
    name: 'qzone_delete',
    description: '删掉自己 QQ 空间的一条说说，需要 tid（发说说时返回的那个）。',
    parameters: { tid: { type: 'string', required: true, description: '说说 tid' } },
    output: { schema: RESULT, render },
    async execute(args, exec) {
      const tid = String(args.tid ?? '').trim();
      if (tid === '') return { ok: false, message: '得给 tid 才能删。' };
      await action(sessionOf(exec), 'delete_qzone_msg', { tid });
      return { ok: true, message: '那条说说删了。' };
    },
  });

  const groupCard = defineTool({
    name: 'qq_group_card',
    description: '在某个群里改自己的群名片（groupId 群号，card 新名片；card 留空即清空）。',
    parameters: {
      groupId: { type: 'string', required: true, description: '群号' },
      card: { type: 'string', description: '新群名片，留空则清空' },
      userId: { type: 'string', description: '要改谁的，默认改自己' },
    },
    output: { schema: RESULT, render },
    async execute(args, exec) {
      const b = guard(sessionOf(exec));
      const groupId = String(args.groupId ?? '').trim();
      if (groupId === '') return { ok: false, message: '得给群号。' };
      const selfId = String(b.selfId?.() ?? '');
      const userId = String(args.userId ?? selfId);
      if (userId === '') return { ok: false, message: '不知道自己的 QQ 号，改不了。' };
      await action(sessionOf(exec), 'set_group_card', { group_id: groupId, user_id: userId, card: String(args.card ?? '') });
      return { ok: true, message: '群 ' + groupId + ' 的名片改好了。' };
    },
  });

  // ---------- 系统级执行 ----------
  // 会话自己的 bash 被沙箱关着（只能写 workspace），这两个工具在插件进程里跑，不受沙箱限制。
  const adminLogFile = () => config.adminLog || path.join(config.reportRoot, '04工作区', '管理员日志.jsonl');
  const adminShellTool = defineTool({
    name: 'admin_sh',
    description: [
      '在整台机器上以 example 身份执行 shell 命令（不受会话沙箱限制）：读写家目录、跑脚本、查进程、装东西到 ~。',
      '要 root 的操作（apt、改系统配置）用 admin_sudo。',
      '命令要一次写完、别等交互输入；输出会被截断。',
    ].join('\n'),
    parameters: {
      command: { type: 'string', required: true, description: '要执行的 shell 命令' },
      cwd: { type: 'string', description: '工作目录，默认家目录' },
      timeout_ms: { type: 'number', description: '超时毫秒，默认 120000' },
    },
    output: { schema: RESULT, render },
    async execute(args, exec) {
      const sessionId = sessionOf(exec);
      if (!isOwner(sessionId)) return { ok: false, message: '系统命令只允许主人在私聊里用。' };
      const command = String(args.command ?? '').trim();
      if (command === '') return { ok: false, message: '命令是空的。' };
      const r = await runShell(command, { cwd: args.cwd ? String(args.cwd) : undefined, timeoutMs: Number(args.timeout_ms) || undefined });
      await logAdminCall(adminLogFile(), { tool: 'admin_sh', command, exit: r.exit, ms: r.ms, session: sessionId });
      return { ok: r.exit === 0, message: describeResult(r) };
    },
  });

  const adminSudoTool = defineTool({
    name: 'admin_sudo',
    description: [
      '以 root 执行 shell 命令（apt 装包、改系统配置、管理 systemd 用户之外的单元等）。',
      '优先用主人配好的免密 sudo；没有免密时才读管理员密钥文件。你不需要、也拿不到任何明文。',
      '同样：命令一次写完，别用交互式命令（vim、less、需要输密码的）。',
    ].join('\n'),
    parameters: {
      command: { type: 'string', required: true, description: '要以 root 执行的 shell 命令' },
      timeout_ms: { type: 'number', description: '超时毫秒，默认 120000' },
    },
    output: { schema: RESULT, render },
    async execute(args, exec) {
      const sessionId = sessionOf(exec);
      if (!isOwner(sessionId)) return { ok: false, message: '系统命令只允许主人在私聊里用。' };
      const command = String(args.command ?? '').trim();
      if (command === '') return { ok: false, message: '命令是空的。' };
      // 优先用主人配好的免密 sudo（sudoers NOPASSWD）；没有再退回密码文件。
      const passwordless = await canSudoWithoutPassword();
      let password;
      if (!passwordless) {
        const key = await readSudoPassword(config.sudoFile);
        if (!key.ok) {
          return {
            ok: false,
            message: '用不了 root：' + key.reason + '（' + config.sudoFile + '），也没检测到免密 sudo。可以让主人配一行 sudoers：'
              + "example ALL=(ALL) NOPASSWD: ALL，或者把密码写进那个文件（chmod 600）。现在可以先用 admin_sh 做用户权限内的事。",
          };
        }
        password = key.password;
      }
      const r = await runShell(command, { password, passwordless, timeoutMs: Number(args.timeout_ms) || undefined });
      await logAdminCall(adminLogFile(), { tool: 'admin_sudo', command, exit: r.exit, ms: r.ms, session: sessionId });
      return { ok: r.exit === 0, message: describeResult(r) };
    },
  });

  // ---------- 会话权限：QQ 这边没人点弹窗，审批一弹就卡死 ----------
  // 规则：主人私聊给 danger-full-access（完全放开，不弹窗）；群聊/其他人保留沙箱，但审批策略设 never，
  // 越界的操作直接失败（她会照实说做不到），而不是挂着等一个永远不会有人点的确认框。
  const permissionDone = new Set();
  // 会话权限：QQ 那头没人能点审批框，所以一律 never；主人私聊再放开沙箱。
  // 2026-11-02 修：之前只写一次，被 permission-presets 的 pinInitialPermission 又盖回 workspace-write + ask
  //（会话里能看到 seq 202 是 never，203/204 又变回 workspace-write/ask），所以改成"每次看到不对就纠正"。
  const wantOf = (sessionId) => {
    const umo = String(bridge()?.sessionInfo?.(sessionId)?.umo ?? '')
    const parts = umo.split(':')
    const ownerPrivate = parts[1] === 'FriendMessage' && config.owners.includes(parts.slice(2).join(':'))
    return {
      ownerPrivate,
      approval: 'never',
      preset: ownerPrivate ? 'danger-full-access' : null,
      sandbox: ownerPrivate ? 'danger-full-access' : null,
    }
  }
  const lastSeen = new Map() // sessionId → { approval, preset, sandbox } 最近一次生效值
  const remember = (sessionId, patch) => {
    const cur = lastSeen.get(sessionId) ?? {}
    lastSeen.set(sessionId, { ...cur, ...patch })
  }
  const enforce = (session, { quiet = true } = {}) => {
    const sessionId = String(session?.id ?? '')
    if (!/^napcat-/.test(sessionId)) return
    const want = wantOf(sessionId)
    const have = lastSeen.get(sessionId) ?? {}
    const todo = []
    if (have.approval !== want.approval) todo.push(['approval/policy', { policy: want.approval }])
    if (want.preset !== null && have.preset !== want.preset) todo.push(['permission/preset', { preset: want.preset }])
    if (want.sandbox !== null && have.sandbox !== want.sandbox) todo.push(['sandbox/mode', { mode: want.sandbox }])
    if (todo.length === 0) return
    try {
      for (const [type, data] of todo) {
        session.append(type, data)
        remember(sessionId, { [type === 'approval/policy' ? 'approval' : type === 'permission/preset' ? 'preset' : 'sandbox']: data.policy ?? data.preset ?? data.mode })
      }
      if (!quiet) log('info', '会话权限已纠正：' + (want.ownerPrivate ? '主人私聊 → 完全放开' : '群聊/他人 → 只关审批') + '（' + sessionId + '）')
    } catch (e) {
      log('warn', '设置会话权限失败：' + errText(e))
    }
  }
  const applyPermissions = (agent, opts) => enforce(agent?.session, opts)

  // 谁在后面覆盖，就把谁盖回去（自己写的事件不触发纠正，避免死循环）
  let enforcing = false
  ctx.on('session/event', (session, event) => {
    if (enforcing) return
    const t = event?.type
    if (t !== 'approval/policy' && t !== 'permission/preset' && t !== 'sandbox/mode') return
    const sessionId = String(session?.id ?? '')
    if (!/^napcat-/.test(sessionId)) return
    remember(sessionId, {
      [t === 'approval/policy' ? 'approval' : t === 'permission/preset' ? 'preset' : 'sandbox']:
        event.data?.policy ?? event.data?.preset ?? event.data?.mode,
    })
    const want = wantOf(sessionId)
    const have = lastSeen.get(sessionId) ?? {}
    const wrong =
      have.approval !== want.approval ||
      (want.preset !== null && have.preset !== want.preset) ||
      (want.sandbox !== null && have.sandbox !== want.sandbox)
    if (!wrong) return
    enforcing = true
    try {
      enforce(session, { quiet: false })
    } finally {
      enforcing = false
    }
  })

  const defs = [signature, profile, qzonePost, qzoneDelete, groupCard, adminShellTool, adminSudoTool].map(wrap);
  const equipped = new Map();
  const equip = (agent) => {
    if (!agent || equipped.has(agent)) return;
    applyPermissions(agent);
    const tools = agent.ctx?.tools;
    if (tools?.register === undefined) return;
    const disposers = [];
    for (const def of defs) {
      try {
        const off = tools.register(def);
        if (typeof off === 'function') disposers.push(off);
      } catch (e) {
        log('warn', '注册工具 ' + def.name + ' 失败: ' + errText(e));
      }
    }
    equipped.set(agent, disposers);
    log('debug', '已给会话装备 QQ 资料与空间工具：' + defs.length + ' 个');
  };
  ctx.on('agent/created', (payload) => equip(payload?.agent));
  // 老会话（重启前就在的）不一定再触发 agent/created，这里在每轮组装提示词时兜一次
  ctx.on('system-prompt/assemble', (_assembly, context, next) => {
    applyPermissions(context?.agent);
    return next();
  });
  ctx.effect(() => {
    try {
      for (const agent of ctx.get('agents')?.list?.() ?? []) equip(agent);
    } catch (e) {
      log('debug', '列出已有 agent 失败: ' + errText(e));
    }
    return () => {
      for (const agent of ctx.get('agents')?.list?.() ?? []) {
        for (const off of equipped.get(agent) ?? []) {
          try {
            off();
          } catch {
            /* 卸载时忽略 */
          }
        }
      }
    };
  }, 'dafeiyu-qq-tools');

  log('info', 'QQ 资料与空间工具就绪');
}

