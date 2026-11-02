console.log('[dafeiyu-vault] module loaded');
// 大肥鱼小窝文件工具（DSH 版）
// 对应 AstrBot 的 astrbot_plugin_dafeiyu_home：读写/整理 /workspace/vault、检索表情包、把文件发给主人。
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { defineTool } from '@deepseek-ai/dsh-tools';
import z from '@deepseek-ai/schemastery';
import { hitCategories, pickBest, rankMemes, suggestCategories } from './meme-ranking.js';

export const name = 'dafeiyu-vault';
export const inject = ['tools', 'napcat'];

export const Config = z.object({
  root: z.string().default('/workspace/vault').description('小窝根目录'),
  inbox: z.string().default('01收件箱'),
  library: z.string().default('02资料库'),
  output: z.string().default('03任务输出'),
  work: z.string().default('04工作区'),
  temp: z.string().default('05临时'),
  archive: z.string().default('06归档'),
  owners: z.array(z.string()).default([]).description('主人 QQ 号，只有这些人的私聊能用这些工具'),
  indexFile: z.string().default('文件索引.jsonl'),
  maxReadChars: z.number().default(60000),
  maxWriteBytes: z.number().default(2 * 1024 * 1024),
  memeRoots: z.array(z.string()).default([]).description('额外的表情包目录（绝对路径），例如旧 AstrBot 的表情包库'),
});

const RESULT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ok: { type: 'boolean', required: true },
    message: { type: 'string', required: true },
    path: { type: 'string' },
  },
};
const render = (_args, value) => [{ type: 'text', text: String(value.message ?? '') }];

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.svg']);
const KIND_BY_EXT = {
  '.md': '文档', '.txt': '文档', '.pdf': '文档', '.docx': '文档', '.doc': '文档', '.epub': '文档',
  '.xlsx': '表格', '.xls': '表格', '.csv': '表格',
  '.png': '图片', '.jpg': '图片', '.jpeg': '图片', '.webp': '图片', '.gif': '图片', '.bmp': '图片', '.svg': '图片',
  '.mp3': '音视频', '.wav': '音视频', '.mp4': '音视频', '.mkv': '音视频', '.flac': '音视频', '.webm': '音视频',
  '.zip': '压缩包', '.7z': '压缩包', '.rar': '压缩包', '.tar': '压缩包', '.gz': '压缩包',
  '.js': '代码', '.ts': '代码', '.py': '代码', '.json': '代码', '.yml': '代码', '.yaml': '代码', '.html': '代码',
};

const now = () => new Date();
const stamp = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const kindOf = (file) => KIND_BY_EXT[path.extname(String(file)).toLowerCase()] ?? '其他';
const sessionOf = (exec) => String(exec?.agent?.session?.id ?? '');
// sendBySession 要的是 MessageSession{platform_name,message_type,session_id}，
// 而 bridge.sessionInfo() 给的是 {umo,sessionId,platformId,type,userId,...}，直接传会变成 undefined:undefined:undefined。
const sessionFor = (info, umo) => {
  if (info !== undefined && info !== null) {
    const group = info.type === 'group';
    return {
      platform_name: String(info.platformId ?? 'qq'),
      message_type: group ? 'GroupMessage' : 'FriendMessage',
      session_id: String((group ? info.groupId : info.userId) ?? ''),
      selfId: info.selfId,
    };
  }
  const parts = String(umo ?? '').split(':');
  return {
    platform_name: parts[0] || 'qq',
    message_type: parts[1] || 'FriendMessage',
    session_id: parts.slice(2).join(':'),
  };
};
const errText = (e) => (e instanceof Error ? e.message : String(e));
// 工具里没有事件上下文，callAction 无法自动定位客户端；显式带上 self_id，避免多客户端接入时 ApiNotAvailable。
const selfIdArg = (b) => {
  const id = b?.selfId?.();
  return id === undefined || id === null || id === '' ? {} : { self_id: String(id) };
};
// 桥接自己的 sendBySession 走 adapter.bot.callAction 且不带 self_id：只要同时接了第二个 OneBot 客户端
// （测试用的模拟端、多开 NapCat）就会抛 ApiNotAvailable。这里退到带 self_id 的原生发消息动作。
const chainToSegments = (chain) => chain.map((c) => {
  if (c.type === 'Plain') return { type: 'text', data: { text: String(c.text ?? '') } };
  if (c.type === 'Image') return { type: 'image', data: { file: String(c.file ?? '') } };
  if (c.type === 'File') return { type: 'file', data: { file: String(c.file_ ?? c.file ?? ''), name: String(c.name ?? '') } };
  return c;
});
async function sendViaSession(bridge, session, chain) {
  try {
    await bridge.sendBySession(session, { chain });
    return;
  } catch (e) {
    if (!errText(e).includes('ApiNotAvailable')) throw e;
  }
  const group = session.message_type === 'GroupMessage';
  const base = group ? { group_id: Number(session.session_id) } : { user_id: Number(session.session_id) };
  const selfArg = session?.selfId !== undefined && session?.selfId !== null && session?.selfId !== ''
    ? { self_id: String(session.selfId) }
    : selfIdArg(bridge);
  const segments = chainToSegments(chain);
  const files = segments.filter((s) => s.type === 'file');
  const rest = segments.filter((s) => s.type !== 'file');
  for (const file of files) {
    await bridge.callAction(group ? 'upload_group_file' : 'upload_private_file', {
      ...base,
      file: file.data.file,
      name: file.data.name || undefined,
      ...selfArg,
    });
  }
  if (rest.length > 0) {
    await bridge.callAction(group ? 'send_group_msg' : 'send_private_msg', {
      ...base,
      message: rest,
      ...selfArg,
    });
  }
}

export function apply(ctx, config) {
  console.log('[dafeiyu-vault] apply start');
  const root = path.resolve(config.root);
  const layout = {
    inbox: config.inbox,
    library: config.library,
    output: config.output,
    work: config.work,
    temp: config.temp,
    archive: config.archive,
  };
  const log = (level, text) => {
    try {
      ctx.logger(level)('[dafeiyu-vault] ' + text);
    } catch {
      /* 日志失败不影响工具 */
    }
  };

  /** 只允许落在小窝里的路径；返回绝对路径 */
  const resolveIn = (p, fallback = '.') => {
    const raw = String(p ?? '').trim() || fallback;
    const abs = path.isAbsolute(raw) ? path.resolve(raw) : path.resolve(root, raw);
    const rel = path.relative(root, abs);
    if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('这个路径不在小窝里：' + raw);
    return abs;
  };
  const relOf = (abs) => path.relative(root, abs).split(path.sep).join('/');
  const labelOf = (abs) => {
    const rel = path.relative(root, abs);
    return rel.startsWith('..') ? abs : rel.split(path.sep).join('/');
  };
  const bridgeOf = () => ctx.get('napcat');
  const isOwnerChat = (sessionId) => {
    const info = bridgeOf()?.sessionInfo?.(sessionId);
    const umo = String(info?.umo ?? '');
    const parts = umo.split(':');
    if (parts.length < 3) return { ok: false, umo };
    const type = parts[1];
    const id = parts.slice(2).join(':');
    return { ok: type === 'FriendMessage' && config.owners.includes(id), umo };
  };
  const guardOwner = (sessionId) => {
    const owner = isOwnerChat(sessionId);
    if (!owner.ok) throw new Error('小窝工具只允许主人在 QQ 私聊里使用。');
    return owner;
  };

  const appendIndex = async (action, abs) => {
    const line = JSON.stringify({ time: now().toISOString(), action, path: relOf(abs) }) + '\n';
    await fsp.appendFile(path.join(root, config.indexFile ?? '文件索引.jsonl'), line, 'utf8').catch(() => {});
  };

  // 工具抛错时自动写一份报告到 04工作区/错误报告（对应 AstrBot 版的行为）
  const SECRET_RULES = [
    [/sk-[A-Za-z0-9_-]{8,}/g, 'sk-***'],
    [/Bearer\s+[A-Za-z0-9._-]{10,}/g, 'Bearer ***'],
    [/pbkdf2_sha256\$[^\s"']+/g, 'pbkdf2_sha256$***'],
    [/((?:password|passwd|api_key|apikey|secret|token|jwt_secret)\s*["']?\s*[:=]\s*["']?)[^\s"',}]+/gi, '$1***'],
    [/1[3-9]\d{9}/g, '1**********'],
    [/\b\d{17,19}\b/g, '***'],
  ];
  const redact = (text) => SECRET_RULES.reduce((acc, [re, rep]) => acc.replace(re, rep), String(text ?? ''));
  const reportToolError = async (toolName, args, error) => {
    try {
      const message = String(error?.message ?? error ?? '');
      // 预期内的拒绝（权限、路径越界、参数校验）不写报告，避免噪声
      if (/只允许主人|这个路径不在小窝里|不支持的动作|缺少参数|不是目录|只能读取|只能写入/.test(message)) return;
      const dir = path.join(root, config.work, '错误报告');
      await fsp.mkdir(dir, { recursive: true });
      const t = now();
      const day = stamp(t);
      const hms = `${String(t.getHours()).padStart(2, '0')}${String(t.getMinutes()).padStart(2, '0')}${String(t.getSeconds()).padStart(2, '0')}`;
      const slug = String(toolName).replace(/[^A-Za-z0-9_-]/g, '_');
      const file = path.join(dir, `${day}_${slug}_${hms}.md`);
      const body = [
        `# 工具异常 · ${toolName}`,
        '',
        `- 记录时间：${day} ${hms.slice(0, 2)}:${hms.slice(2, 4)}:${hms.slice(4, 6)}`,
        `- 工具：${toolName}`,
        `- 场景：DSH 版大肥鱼（QQ）`,
        '',
        '## 调用参数',
        '',
        '```json',
        redact(JSON.stringify(args ?? {}, null, 2)),
        '```',
        '',
        '## 错误',
        '',
        '```',
        redact(error?.stack ?? String(error)),
        '```',
        '',
        '## 处理建议',
        '',
        '- 先看「错误」段的最后一行，确认是桥接调用、路径、还是权限问题。',
        '- 如果是 `ApiNotAvailable`，通常是对应客户端没连上或 `self_id` 不对。',
        '- 修完可以让主人再试一次，同样错误 30 分钟内会另起一份报告，便于对比。',
        '',
      ].join('\n');
      await fsp.writeFile(file, body, 'utf8');
      await appendIndex('错误报告', file);
    } catch {
      /* 报告器自己出错时静默，不能影响主流程 */
    }
  };
  const unique = async (abs) => {
    const ext = path.extname(abs);
    const base = abs.slice(0, abs.length - ext.length);
    for (let i = 2; i < 1000; i++) {
      const candidate = `${base}_${i}${ext}`;
      try {
        await fsp.access(candidate);
      } catch {
        return candidate;
      }
    }
    throw new Error('同名文件太多了，换个名字吧。');
  };
  const sectionDated = (section) => path.join(root, layout[section] ?? section, `${now().getFullYear()}-${String(now().getMonth() + 1).padStart(2, '0')}`);

  // ---------- 工具：文件 ----------
  const filesTool = defineTool({
    name: 'vault_files',
    description: [
      '主人小窝（/workspace/vault）的文件工具。path 一律填小窝内的相对路径，例如 02资料库/人设图/2026-10。',
      'action=list 看目录（只列一层，带大小/时间）；action=read 看文本内容（超长会截断）；',
      'action=write 写文本（path 可只给文件名，会自动落到 03任务输出/年-月/）；action=mkdir 建目录；',
      'action=move 把文件挪进 02资料库 按类型+年月归档（destination 留空时），也可以指定目标目录。',
      '写进来的长内容先落到小窝，别直接刷屏。不能删除文件。',
    ].join('\n'),
    parameters: {
      action: { type: 'string', enum: ['list', 'read', 'write', 'mkdir', 'move'], required: true, description: '要做的操作' },
      path: { type: 'string', required: true, description: '小窝内相对路径；write 时可以是文件名' },
      content: { type: 'string', description: 'write 要写入的文本' },
      destination: { type: 'string', description: 'move 的目标目录（可省略，默认按类型归档）' },
    },
    output: { schema: RESULT, render },
    async execute(args, exec) {
      guardOwner(sessionOf(exec));
      const action = String(args.action);
      if (action === 'list') {
        const dir = resolveIn(args.path);
        const entries = await fsp.readdir(dir, { withFileTypes: true });
        if (entries.length === 0) return { ok: true, message: '这个目录是空的：' + relOf(dir), path: relOf(dir) };
        const rows = [];
        for (const e of entries.sort((a, b) => a.name.localeCompare(b.name)).slice(0, 200)) {
          const abs = path.join(dir, e.name);
          const st = await fsp.stat(abs).catch(() => null);
          rows.push(e.isDirectory() ? `[目录] ${e.name}` : `${e.name}  ${st ? Math.round(st.size / 1024) + 'KB' : ''}`);
        }
        return { ok: true, message: relOf(dir) + ' 里有 ' + entries.length + ' 项：\n' + rows.join('\n'), path: relOf(dir) };
      }
      if (action === 'read') {
        const file = resolveIn(args.path);
        const st = await fsp.stat(file);
        if (!st.isFile()) return { ok: false, message: '这不是文件：' + relOf(file) };
        const text = await fsp.readFile(file, 'utf8');
        const body = text.length > config.maxReadChars ? text.slice(0, config.maxReadChars) + '\n…（后面还有 ' + (text.length - config.maxReadChars) + ' 字，需要的话分段读）' : text;
        return { ok: true, message: body, path: relOf(file) };
      }
      if (action === 'write') {
        let file = resolveIn(args.path);
        if (path.dirname(file) === root) file = path.join(sectionDated('output'), args.path);
        const text = String(args.content ?? '');
        const bytes = Buffer.byteLength(text, 'utf8');
        if (bytes > config.maxWriteBytes) return { ok: false, message: '内容太大（' + bytes + ' 字节），超过 2MB 上限，拆开写吧。' };
        await fsp.mkdir(path.dirname(file), { recursive: true });
        file = await fsp.access(file).then(() => unique(file)).catch(() => file);
        await fsp.writeFile(file, text, 'utf8');
        await appendIndex('写入', file);
        return { ok: true, message: '写好了：' + relOf(file) + '（' + bytes + ' 字节）', path: relOf(file) };
      }
      if (action === 'mkdir') {
        const dir = resolveIn(args.path);
        await fsp.mkdir(dir, { recursive: true });
        return { ok: true, message: '目录建好了：' + relOf(dir), path: relOf(dir) };
      }
      if (action === 'move') {
        const source = resolveIn(args.path);
        const st = await fsp.stat(source);
        if (!st.isFile()) return { ok: false, message: '只能归档文件：' + relOf(source) };
        const targetDir = args.destination ? resolveIn(args.destination) : path.join(root, layout.library, kindOf(source), `${now().getFullYear()}-${String(now().getMonth() + 1).padStart(2, '0')}`);
        await fsp.mkdir(targetDir, { recursive: true });
        const target = await fsp.access(path.join(targetDir, path.basename(source))).then(() => unique(path.join(targetDir, path.basename(source)))).catch(() => path.join(targetDir, path.basename(source)));
        await fsp.copyFile(source, target);
        await appendIndex('整理', target);
        return { ok: true, message: '归档好了：' + relOf(target), path: relOf(target) };
      }
      return { ok: false, message: '不认识的操作：' + action };
    },
  });

  // ---------- 工具：发文件 ----------
  const sendTool = defineTool({
    name: 'vault_send_file',
    description: '把小窝里的文件或图片发给主人（path 填小窝内相对路径）。图片会按图片消息发，其他文件按文件发；caption 是可选的附带文字。',
    parameters: {
      path: { type: 'string', required: true, description: '小窝内相对路径' },
      caption: { type: 'string', description: '随文件一起发的文字' },
    },
    output: { schema: RESULT, render },
    async execute(args, exec) {
      const sessionId = sessionOf(exec);
      const owner = guardOwner(sessionId);
      const bridge = bridgeOf();
      if (bridge?.sendBySession === undefined) return { ok: false, message: 'QQ 桥接现在没接上，发不出去。' };
      const file = resolveIn(args.path);
      const st = await fsp.stat(file);
      if (!st.isFile()) return { ok: false, message: '这不是文件：' + relOf(file) };
      const session = sessionFor(bridge.sessionInfo(sessionId), owner.umo);
      const ext = path.extname(file).toLowerCase();
      const chain = [];
      if (args.caption) chain.push({ type: 'Plain', text: String(args.caption) });
      if (IMAGE_EXT.has(ext)) chain.push({ type: 'Image', file: `file:///${file.split(path.sep).join('/')}` });
      else chain.push({ type: 'File', name: path.basename(file), file_: `file:///${file.split(path.sep).join('/')}` });
      await sendViaSession(bridge, session, chain);
      await appendIndex('发送给主人', file);
      return { ok: true, message: '文件已经发出去了（' + path.basename(file) + '）。回复里别复述路径。' };
    },
  });

  // ---------- 表情包：索引 / 分类 / 检索 / 发送 / 收录 ----------
  // 设计要点：不再靠猜文件名。索引.json 由 tools/meme-reindex.mjs 生成（分类体系在 tools/meme-taxonomy.mjs），
  // 每张图带中文分类、含义、标签；取用时排除最近发过的，避免永远只有那几张固定表情。
  const MEME_DIR = () => path.join(root, layout.library, '表情包');
  const MEME_INDEX_FILE = () => path.join(MEME_DIR(), '索引.json');
  const MEME_USAGE_FILE = () => path.join(MEME_DIR(), '使用记录.jsonl');
  const MEME_VECTOR_FILE = () => path.join(MEME_DIR(), '语义向量.json');
  const MEME_EMBED_URL = process.env.MEME_EMBED_URL ?? 'http://127.0.0.1:11434';
  const MEME_EMBED_MODEL = process.env.MEME_EMBED_MODEL ?? 'bge-m3';
  const MEME_MASTER_DIR = () => path.join(MEME_DIR(), '收自主人');
  const MEME_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp']);

  let memeCache = { mtime: -1, index: null };
  const loadMemeIndex = async () => {
    const file = MEME_INDEX_FILE();
    const st = await fsp.stat(file).catch(() => null);
    if (st === null) return null;
    if (memeCache.index !== null && memeCache.mtime === st.mtimeMs) return memeCache.index;
    const raw = JSON.parse(await fsp.readFile(file, 'utf8'));
    const images = (raw.images ?? []).map((img) => ({ ...img, abs: path.join(MEME_DIR(), img.rel) }));
    const index = { ...raw, images };
    memeCache = { mtime: st.mtimeMs, index };
    return index;
  };
  const hasMemeIndex = async () => (await fsp.stat(MEME_INDEX_FILE()).catch(() => null)) !== null;

  let memeVectors = { mtime: -1, data: null };
  /** 语义向量（tools/meme-embed.mjs 生成），没有就退化成纯关键词 */
  const loadMemeVectors = async () => {
    const st = await fsp.stat(MEME_VECTOR_FILE()).catch(() => null);
    if (st === null) return null;
    if (memeVectors.data !== null && memeVectors.mtime === st.mtimeMs) return memeVectors.data;
    let data = null;
    try {
      data = JSON.parse(await fsp.readFile(MEME_VECTOR_FILE(), 'utf8'));
    } catch {
      data = null;
    }
    memeVectors = { mtime: st.mtimeMs, data };
    return memeVectors.data;
  };
  /** 把一句话变成向量；ollama 不在或超时就返回 null，不影响关键词检索 */
  const embedQuery = async (text) => {
    const q = String(text ?? '').trim();
    if (!q) return null;
    try {
      const res = await fetch(`${MEME_EMBED_URL}/api/embeddings`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: MEME_EMBED_MODEL, prompt: q }),
        signal: AbortSignal.timeout(2500),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return Array.isArray(data?.embedding) ? data.embedding : null;
    } catch {
      return null;
    }
  };
  /** 关键词 + 语义一起排 */
  const rankMemesSmart = async (index, query, category) => {
    const text = [String(category ?? '').trim(), String(query ?? '').trim()].filter((x) => x.length > 0).join(' ');
    const [vectors, queryVec] = await Promise.all([loadMemeVectors(), embedQuery(text)]);
    return rankMemes(index, query, category, { vectors, queryVec });
  };

  /** 索引缺失/过期时的兜底：直接扫目录，按目录名和文件名当线索 */
  const scanMemesFallback = async () => {
    const images = [];
    const roots = [MEME_DIR(), ...config.memeRoots.map((d) => path.resolve(d))];
    const walk = async (dir, depth) => {
      if (depth > 4) return;
      const entries = await fsp.readdir(dir, { withFileTypes: true }).catch(() => []);
      for (const e of entries) {
        const abs = path.join(dir, e.name);
        if (e.isDirectory()) await walk(abs, depth + 1);
        else if (MEME_EXT.has(path.extname(e.name).toLowerCase())) {
          const rel = path.relative(MEME_DIR(), abs).split(path.sep).join('/');
          images.push({ rel, abs, cat: '待归类', tags: [], note: '' });
        }
      }
    };
    for (const dir of roots) await walk(dir, 0);
    return { total: images.length, taxonomy: {}, categories: [], images, fallback: true };
  };

  const readMemeUsage = async (limit = 400) => {
    const text = await fsp.readFile(MEME_USAGE_FILE(), 'utf8').catch(() => '');
    const out = [];
    for (const line of text.split('\n').slice(-limit)) {
      if (!line.trim()) continue;
      try {
        out.push(JSON.parse(line));
      } catch {
        /* 坏行跳过 */
      }
    }
    return out;
  };
  const recordMemeUsage = async (rel, sessionId) => {
    const line = JSON.stringify({ t: now().toISOString(), rel, session: sessionId }) + '\n';
    await fsp.mkdir(MEME_DIR(), { recursive: true }).catch(() => {});
    await fsp.appendFile(MEME_USAGE_FILE(), line, 'utf8').catch(() => {});
  };

  /** 选一张：分类不匹配就不硬凑，交给调用方换情绪或只发文字 */
  const pickMeme = async (index, query, category, sessionId) => {
    const ranked = await rankMemesSmart(index, query, category);
    if (ranked.length === 0) {
      return {
        ok: false,
        reason: 'no_matching_meme',
        message: '没有匹配「' + (category || query) + '」的表情，本轮只发文字。可以换成：' + suggestCategories(index, category).join('、'),
      };
    }
    const usage = await readMemeUsage();
    const img = pickBest(ranked, usage, sessionId);
    return { ok: true, img };
  };

  /** 收录新图后顺手补一条语义向量，否则它只能靠关键词被搜到 */
  const addVectorFor = async (entry) => {
    const vec = await embedQuery([entry.cat, entry.note, ...(entry.tags ?? [])].filter(Boolean).join(' '));
    if (vec === null) return false;
    let store = { model: MEME_EMBED_MODEL, dim: vec.length, items: {} };
    try {
      store = JSON.parse(await fsp.readFile(MEME_VECTOR_FILE(), 'utf8'));
    } catch {
      store = { model: MEME_EMBED_MODEL, dim: vec.length, items: {} };
    }
    store.items[entry.rel] = vec.map((v) => Number(v.toFixed(5)));
    store.dim = vec.length;
    await fsp.writeFile(MEME_VECTOR_FILE(), JSON.stringify(store), 'utf8');
    memeVectors = { mtime: -1, data: null };
    return true;
  };

  // 只给分类和含义：以前带文件路径，模型会把路径原样念出来，主人在 QQ 里看到的就是一串文件位置。
  const describeMeme = (img) => {
    const extra = img.note ? '｜' + img.note : '';
    return `${img.cat}${extra}`;
  };

  const memeCatalogTool = defineTool({
    name: 'meme_catalog',
    description: [
      '表情包分类清单：每个情绪/场合类有多少张、什么场景该用、什么场景别用。',
      '发表情之前先看这个，按真实情绪挑类别，再用 meme_send 发；类别是空的就别硬发。',
    ].join('\n'),
    parameters: {
      kind: { type: 'string', enum: ['all', 'mood', 'scene'], description: '只看情绪类 / 场合类 / 全部，默认 all' },
    },
    output: { schema: RESULT, render },
    async execute(args, exec) {
      guardOwner(sessionOf(exec));
      const index = (await loadMemeIndex()) ?? (await scanMemesFallback());
      if ((index.images ?? []).length === 0) return { ok: true, message: '表情包库里暂时没有图。' };
      const want = String(args.kind ?? 'all');
      const taxonomy = index.taxonomy ?? {};
      const rows = [];
      for (const c of index.categories ?? []) {
        const meta = taxonomy[c.cat] ?? {};
        if (want !== 'all' && meta.kind !== undefined && meta.kind !== want) continue;
        if ((c.count ?? 0) === 0) continue;
        rows.push(`【${c.cat}】${c.count} 张｜${meta.desc ?? ''}` + (meta.use ? `\n   用：${meta.use}` : '') + (meta.avoid ? `\n   别：${meta.avoid}` : ''));
      }
      const empty = Object.keys(taxonomy).filter((c) => !(index.categories ?? []).some((x) => x.cat === c && (x.count ?? 0) > 0));
      return {
        ok: true,
        message: `共 ${index.total ?? (index.images ?? []).length} 张表情` + (index.fallback ? '（索引缺失，正在按目录兜底）' : '') + '：\n' + rows.join('\n') + (empty.length > 0 ? `\n空分类，别硬发：${empty.join('、')}` : ''),
      };
    },
  });

  const memeTool = defineTool({
    name: 'meme_search',
    description: [
      '按情绪/分类/关键词在表情包里找图，返回路径和这张图的含义。',
      'category 填 meme_catalog 里的分类名（开心、贴贴、撒娇…），query 写具体情绪或场景，可空格分隔。',
      '找到后可以用 meme_send 直接发，也可以只用来确认有没有合适的图。',
    ].join('\n'),
    parameters: {
      query: { type: 'string', description: '情绪或场景关键词，可空格分隔多个' },
      category: { type: 'string', description: '分类名，优先于关键词' },
      limit: { type: 'number', description: '最多返回几个，默认 6' },
    },
    output: { schema: RESULT, render },
    async execute(args, exec) {
      guardOwner(sessionOf(exec));
      const index = (await loadMemeIndex()) ?? (await scanMemesFallback());
      if ((index.images ?? []).length === 0) return { ok: true, message: '表情包库里暂时没有图。' };
      const limit = Math.min(Math.max(Number(args.limit ?? 6) || 6, 1), 12);
      const ranked = await rankMemesSmart(index, args.query, args.category);
      if (ranked.length === 0) {
        return {
          ok: true,
          message: '没有匹配「' + String(args.query ?? args.category ?? '') + '」的表情。可以试试：' + suggestCategories(index, String(args.category ?? '')).join('、'),
        };
      }
      const picked = ranked.slice(0, limit);
      return { ok: true, message: '匹配到 ' + picked.length + ' 张（回复里别贴路径，直接用 meme_send 发就行）：\n' + picked.map((x) => describeMeme(x.img)).join('\n') };
    },
  });

  const memeCooldowns = new Map();
  const memeSending = new Set();
  const memeSendTool = defineTool({
    name: 'meme_send',
    description: [
      '按情绪或场合挑一张表情包发给主人（一条回复最多一张，多数轮次只发文字）。',
      'category 用 meme_catalog 里的分类名，query 写这一轮的具体情绪（比如「被夸了害羞」「算力不够心疼」）。',
      '没有匹配就只发文字；主人难过或谈正事时不要用表情包代替回答。',
      '发送成功后不要在回复里贴路径或文件名，接着说话就行。',
    ].join('\n'),
    parameters: {
      query: { type: 'string', description: '这一轮的情绪或场景' },
      category: { type: 'string', description: '分类名，优先于关键词' },
    },
    output: { schema: RESULT, render },
    async execute(args, exec) {
      const sessionId = sessionOf(exec);
      const owner = guardOwner(sessionId);
      const bridge = bridgeOf();
      if (bridge?.sendBySession === undefined) return { ok: false, message: 'QQ 桥接现在没接上，发不出去。' };
      if (!String(args.query ?? args.category ?? '').trim()) return { ok: false, message: '没有明确的表情场景，本轮只发文字。' };
      if (Date.now() - (memeCooldowns.get(sessionId) ?? -Infinity) < 8000) return { ok: false, message: '刚发过表情，本轮继续用文字，不要连续发图。' };
      if (memeSending.has(sessionId)) return { ok: false, message: '表情正在发送，本轮继续用文字。' };
      memeSending.add(sessionId);
      try {
        const index = (await loadMemeIndex()) ?? (await scanMemesFallback());
        if ((index.images ?? []).length === 0) return { ok: false, message: '表情包库里暂时没有图。' };
        const picked = await pickMeme(index, args.query, args.category, sessionId);
        if (picked.ok !== true) return picked;
        const file = picked.img.abs;
        await fsp.access(file);
        await sendViaSession(bridge, sessionFor(bridge.sessionInfo(sessionId), owner.umo), [
          { type: 'Image', file: `file:///${file.split(path.sep).join('/')}` },
        ]);
        memeCooldowns.set(sessionId, Date.now());
        await recordMemeUsage(picked.img.rel, sessionId);
        await appendIndex('发表情包', file);
        return { ok: true, message: '表情已经发出去了（' + describeMeme(picked.img) + '）。回复里只接着说话，别复述这张图叫什么。' };
      } finally {
        memeSending.delete(sessionId);
      }
    },
  });

  /** 把新图写进索引（保持分类计数、总数为准；不改分类体系本身） */
  const appendMemesToIndex = async (entries) => {
    const file = MEME_INDEX_FILE();
    let raw;
    try {
      raw = JSON.parse(await fsp.readFile(file, 'utf8'));
    } catch {
      return false;
    }
    const images = raw.images ?? [];
    const known = new Set(images.map((x) => x.rel));
    let added = 0;
    for (const entry of entries) {
      if (known.has(entry.rel)) continue;
      images.push(entry);
      known.add(entry.rel);
      added += 1;
    }
    if (added === 0) return true;
    const counts = new Map();
    for (const img of images) counts.set(img.cat, (counts.get(img.cat) ?? 0) + 1);
    raw.images = images;
    raw.total = images.length;
    raw.generated_at = now().toISOString();
    raw.categories = Object.keys(raw.taxonomy ?? {}).map((cat) => ({
      cat,
      kind: raw.taxonomy?.[cat]?.kind,
      desc: raw.taxonomy?.[cat]?.desc,
      count: counts.get(cat) ?? 0,
    }));
    await fsp.writeFile(file, JSON.stringify(raw, null, 1) + '\n', 'utf8');
    memeCache = { mtime: -1, index: null };
    return true;
  };

  // ---------- 工具：把一张本机图片当表情发出去（自己生的表情走这条路） ----------
  const memeSendImageTool = defineTool({
    name: 'meme_send_image',
    description: [
      '把本机的一张图片当表情包发到 QQ（比如刚用 image_generate 生成的表情）。',
      'path 给绝对路径；发完不要在回复里贴路径或文件名，接着说话就行。',
      '一次只发一张；8 秒内不重复发图。',
    ].join('\n'),
    parameters: {
      path: { type: 'string', required: true, description: '本机图片绝对路径（png/jpg/webp/gif）' },
      keep: { type: 'boolean', description: '要不要顺便收进表情包库（默认 false）' },
      category: { type: 'string', description: 'keep=true 时的分类名' },
      note: { type: 'string', description: 'keep=true 时一句话描述画面' },
      tags: { type: 'array', description: 'keep=true 时 2~3 个检索标签' },
    },
    output: { schema: RESULT, render },
    async execute(args, exec) {
      const sessionId = sessionOf(exec);
      const owner = guardOwner(sessionId);
      const bridge = bridgeOf();
      if (bridge?.sendBySession === undefined) return { ok: false, message: 'QQ 桥接现在没接上，发不出去。' };
      const file = path.resolve(String(args.path ?? '').trim());
      if (file === '' || !IMAGE_EXT.has(path.extname(file).toLowerCase())) return { ok: false, message: '给一个 png/jpg/webp/gif 的绝对路径。' };
      const st = await fsp.stat(file).catch(() => null);
      if (st === null || !st.isFile()) return { ok: false, message: '这张图不存在：' + path.basename(file) };
      if (st.size > 15 * 1024 * 1024) return { ok: false, message: '图太大了（' + Math.round(st.size / 1024 / 1024) + 'MB），压一下再发。' };
      if (Date.now() - (memeCooldowns.get(sessionId) ?? -Infinity) < 8000) return { ok: false, message: '刚发过图，本轮继续用文字，不要连续发图。' };
      if (memeSending.has(sessionId)) return { ok: false, message: '正在发送，本轮继续用文字。' };
      memeSending.add(sessionId);
      try {
        await sendViaSession(bridge, sessionFor(bridge.sessionInfo(sessionId), owner.umo), [
          { type: 'Image', file: `file:///${file.split(path.sep).join('/')}` },
        ]);
        memeCooldowns.set(sessionId, Date.now());
        let kept = '';
        if (args.keep === true) {
          const index = await loadMemeIndex();
          const category = String(args.category ?? '').trim();
          const tags = (Array.isArray(args.tags) ? args.tags : []).map((t) => String(t).trim()).filter((t) => t.length > 0).slice(0, 6);
          const note = String(args.note ?? '').trim();
          let cat = Object.keys(index?.taxonomy ?? {}).includes(category) ? category : '待归类';
          if (cat === '待归类' && index !== null) {
            const inferred = [...hitCategories(index, [note, tags.join(' ')].join(' '))];
            const known = inferred.find((c) => (index.categories ?? []).some((x) => x.cat === c));
            if (known) cat = known;
          }
          const dir = path.join(MEME_DIR(), '自制', stamp(now()).slice(0, 7));
          await fsp.mkdir(dir, { recursive: true });
          const ext = path.extname(file).toLowerCase();
          const t = now();
          const hms = `${String(t.getHours()).padStart(2, '0')}${String(t.getMinutes()).padStart(2, '0')}${String(t.getSeconds()).padStart(2, '0')}`;
          let target = path.join(dir, `自制表情_${stamp(t).replace(/-/g, '')}-${hms}${ext}`);
          target = await fsp.access(target).then(() => unique(target)).catch(() => target);
          await fsp.copyFile(file, target);
          const entry = {
            rel: path.relative(MEME_DIR(), target).split(path.sep).join('/'),
            cat,
            pack: '自制',
            pack_name: '自制',
            src: path.basename(target),
            format: ext.replace('.', ''),
            animated: ext === '.gif',
            bytes: st.size,
            note: note || (tags.length > 0 ? tags.join('、') : ''),
            tags: tags.length > 0 ? tags : [cat],
            added_at: stamp(t),
            source: 'self',
          };
          await appendMemesToIndex([entry]);
          await addVectorFor(entry).catch(() => false);
          kept = '，也收进库里了（' + cat + '）';
        }
        return { ok: true, message: '发出去了' + kept + '。回复里别念文件名，接着说话。' };
      } finally {
        memeSending.delete(sessionId);
      }
    },
  });

  const memeCollectTool = defineTool({
    name: 'meme_collect',
    description: [
      '把主人最近发来的表情包收进表情包库：存到 02资料库/表情包/收自主人/年-月/，并写进索引。',
      '主人发表情包、或者让你「收一下」「存好这个表情」时用它。',
      'category 填你判断的分类（开心、贴贴、撒娇、生气、委屈、疑惑、惊讶、害羞、困倦、应答、招呼、恰饭、算力、上班、整活、形象、娱乐，拿不准就留空→待归类）；',
      'tags 写两三个以后好检索的词（比如「歪头 无语 问号」）；note 一句话描述画面，没有就别编。',
    ].join('\n'),
    parameters: {
      count: { type: 'number', description: '往前翻几条消息找图，默认 4' },
      category: { type: 'string', description: '分类名，留空进「待归类」' },
      tags: { type: 'array', description: '2~3 个检索标签' },
      note: { type: 'string', description: '一句话描述这张图，不确定就别填' },
    },
    output: { schema: RESULT, render },
    async execute(args, exec) {
      const sessionId = sessionOf(exec);
      const owner = guardOwner(sessionId);
      const bridge = bridgeOf();
      if (bridge?.callAction === undefined) return { ok: false, message: 'QQ 桥接现在没接上，读不到聊天记录。' };
      const index = await loadMemeIndex();
      if (index === null) return { ok: false, message: '表情包索引还没生成（缺 02资料库/表情包/索引.json），先在项目里跑 node tools/meme-reindex.mjs。' };
      const parts = owner.umo.split(':');
      const uid = parts.slice(2).join(':');
      const limit = Math.min(Math.max(Number(args.count ?? 4) || 4, 1), 12);
      const history = await bridge.callAction('get_friend_msg_history', { user_id: uid, count: limit, ...selfIdArg(bridge) }).catch((e) => ({ __err: errText(e) }));
      if (history?.__err) return { ok: false, message: '读聊天记录失败：' + history.__err };
      const messages = history?.data?.messages ?? history?.messages ?? [];
      const files = [];
      for (const msg of messages) {
        for (const seg of Array.isArray(msg?.message) ? msg.message : []) {
          if (seg?.type === 'image' && seg?.data?.file) files.push(String(seg.data.file));
        }
      }
      if (files.length === 0) return { ok: false, message: '往前翻了 ' + limit + ' 条，没找到图片。' };
      const category = String(args.category ?? '').trim();
      let cat = Object.keys(index.taxonomy ?? {}).includes(category) ? category : '待归类';
      const tags = (Array.isArray(args.tags) ? args.tags : []).map((t) => String(t).trim()).filter((t) => t.length > 0).slice(0, 6);
      if (!tags.includes(cat)) tags.unshift(cat);
      const note = String(args.note ?? '').trim();
      if (cat === '待归类') {
        // 没给分类就自己从标签/描述里认一个，认不出才进待归类，保证收进来的图能被检索到
        const inferred = [...hitCategories(index, [note, tags.join(' ')].join(' '))];
        const known = inferred.find((c) => (index.categories ?? []).some((x) => x.cat === c && (x.count ?? 0) >= 0));
        if (known) cat = known;
      }
      const dir = path.join(MEME_MASTER_DIR(), stamp(now()).slice(0, 7));
      await fsp.mkdir(dir, { recursive: true });
      const entries = [];
      const saved = [];
      let i = 0;
      for (const file of files.slice(0, 6)) {
        i += 1;
        const ret = await bridge.callAction('get_image', { file, ...selfIdArg(bridge) }).catch((e) => ({ __err: errText(e) }));
        let bytes;
        if (ret?.file) bytes = await fsp.readFile(String(ret.file).replace(/^file:\/\//, '')).catch(() => undefined);
        else if (ret?.base64) bytes = Buffer.from(String(ret.base64), 'base64');
        else if (ret?.url) bytes = Buffer.from(await (await fetch(String(ret.url))).arrayBuffer());
        if (bytes === undefined) {
          saved.push(`第 ${i} 张读不到：${ret?.__err ?? '未知原因'}`);
          continue;
        }
        const ext = bytes[0] === 0x89 ? '.png' : bytes[0] === 0x47 ? '.gif' : bytes[0] === 0x52 ? '.webp' : '.jpg';
        const t = now();
        const hms = `${String(t.getHours()).padStart(2, '0')}${String(t.getMinutes()).padStart(2, '0')}${String(t.getSeconds()).padStart(2, '0')}`;
        let target = path.join(dir, `主人表情_${stamp(t).replace(/-/g, '')}-${hms}_${String(i).padStart(2, '0')}${ext}`);
        target = await fsp.access(target).then(() => unique(target)).catch(() => target);
        await fsp.writeFile(target, bytes);
        const rel = path.relative(MEME_DIR(), target).split(path.sep).join('/');
        const animated = ext === '.gif' || (ext === '.webp' && bytes.includes('ANIM'));
        entries.push({
          rel,
          cat,
          pack: '收自主人',
          pack_name: '收自主人',
          src: path.basename(target),
          format: ext.replace('.', ''),
          animated: animated === true,
          bytes: bytes.length,
          note: note || (tags.length > 0 ? tags.join('、') : ''),
          tags,
          added_at: stamp(t),
          source: 'master',
        });
        saved.push(`${rel}（${Math.round(bytes.length / 1024)}KB）`);
      }
      if (entries.length === 0) return { ok: false, message: '一张都没存下来：\n' + saved.join('\n') };
      await appendMemesToIndex(entries);
      for (const entry of entries) await addVectorFor(entry).catch(() => false);
      await appendIndex('收录表情', path.join(MEME_MASTER_DIR(), ''));
      return { ok: true, message: `收好了 ${entries.length} 张（分类：${cat}）：\n` + saved.join('\n'), path: path.relative(root, dir).split(path.sep).join('/') };
    },
  });

  // ---------- 工具：把刚收到的聊天图片存进小窝 ----------
  const saveImagesTool = defineTool({
    name: 'vault_save_images',
    description: [
      '把主人最近发来的聊天图片存进小窝。主人发图后说「存好」「收好」「存进 xx」时就用它。',
      'count 是往前翻几条消息找图（默认 6，最多 20）；target 是保存目录（小窝内相对路径，默认 01收件箱/今天日期）；',
      'name_prefix 是文件名前缀（默认 收到的图片），同一批会自动编号。存完返回每张图的路径，需要归档再用 vault_files 的 move。',
    ].join('\n'),
    parameters: {
      count: { type: 'number', description: '往前翻几条消息找图，默认 6' },
      target: { type: 'string', description: '保存目录（小窝内相对路径），默认 01收件箱/今天日期' },
      name_prefix: { type: 'string', description: '文件名前缀，默认 收到的图片' },
    },
    output: { schema: RESULT, render },
    async execute(args, exec) {
      const sessionId = sessionOf(exec);
      const owner = guardOwner(sessionId);
      const bridge = bridgeOf();
      if (bridge?.callAction === undefined) return { ok: false, message: 'QQ 桥接现在没接上，读不到聊天记录。' };
      const parts = owner.umo.split(':');
      const uid = parts.slice(2).join(':');
      const limit = Math.min(Math.max(Number(args.count ?? 6) || 6, 1), 20);
      const history = await bridge.callAction('get_friend_msg_history', { user_id: uid, count: limit, ...selfIdArg(bridge) });
      const messages = history?.data?.messages ?? history?.messages ?? [];
      const images = [];
      for (const msg of messages) {
        const segs = Array.isArray(msg?.message) ? msg.message : [];
        for (const seg of segs) {
          if (seg?.type === 'image' && seg?.data?.file) images.push(String(seg.data.file));
        }
      }
      if (images.length === 0) return { ok: false, message: '往前翻了 ' + limit + ' 条，没找到图片。' };
      const dir = resolveIn(args.target || path.join(layout.inbox, stamp(now())));
      await fsp.mkdir(dir, { recursive: true });
      const prefix = String(args.name_prefix || '收到的图片').replace(/[\\/:*?"<>|]/g, '_');
      const saved = [];
      let i = 0;
      for (const file of images.slice(0, 9)) {
        i += 1;
        const ret = await bridge.callAction('get_image', { file, ...selfIdArg(bridge) }).catch((e) => ({ __err: errText(e) }));
        let bytes;
        if (ret?.file) bytes = await fsp.readFile(String(ret.file).replace(/^file:\/\//, ''));
        else if (ret?.base64) bytes = Buffer.from(String(ret.base64), 'base64');
        else if (ret?.url) bytes = Buffer.from(await (await fetch(String(ret.url))).arrayBuffer());
        if (bytes === undefined) {
          saved.push(`第 ${i} 张读不到：${ret?.__err ?? ret?.message ?? '未知原因'}`);
          continue;
        }
        const ext = bytes[0] === 0x89 ? '.png' : bytes[0] === 0x47 ? '.gif' : bytes[0] === 0x52 ? '.webp' : '.jpg';
        const time = new Date();
        const hhmmss = `${String(time.getHours()).padStart(2, '0')}${String(time.getMinutes()).padStart(2, '0')}${String(time.getSeconds()).padStart(2, '0')}`;
        let target = path.join(dir, `${prefix}_${hhmmss}_${String(i).padStart(2, '0')}${ext}`);
        target = await fsp.access(target).then(() => unique(target)).catch(() => target);
        await fsp.writeFile(target, bytes);
        await appendIndex('接收', target);
        saved.push(`${relOf(target)}（${Math.round(bytes.length / 1024)}KB）`);
      }
      return { ok: true, message: `存好 ${saved.length} 张：\n` + saved.join('\n'), path: relOf(dir) };
    },
  });

  // ---------- 注册到每个 agent ----------
  const defs = [filesTool, sendTool, memeCatalogTool, memeTool, memeSendTool, memeSendImageTool, memeCollectTool, saveImagesTool];
  const guarded = (def) => ({
    ...def,
    execute: async (args, exec) => {
      try {
        const result = await def.execute(args, exec);
        if (result?.ok === false) {
          const msg = String(result.message ?? '');
          if (!/空的|没找到|不存在|不支持|缺少|只允许|不在小窝|只有 \d+ 张|没有图片|读不到/.test(msg)) {
            await reportToolError(def.name, args, new Error(msg));
          }
        }
        return result;
      } catch (error) {
        await reportToolError(def.name, args, error);
        throw error;
      }
    },
  });
  const equipped = new Map();
  const equip = (agent) => {
    if (!agent || equipped.has(agent)) return;
    const tools = agent.ctx?.tools;
    if (tools?.register === undefined) return;
    const disposers = [];
    for (const def of defs.map(guarded)) {
      try {
        const off = tools.register(def);
        if (typeof off === 'function') disposers.push(off);
      } catch (e) {
        log('warn', '注册工具 ' + def.name + ' 失败: ' + errText(e));
      }
    }
    equipped.set(agent, disposers);
  };
  ctx.on('agent/created', (payload) => equip(payload?.agent));
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
  }, 'dafeiyu-vault: tools');

  console.log('[dafeiyu-vault] tools ready, root=' + root);
  log('info', '小窝工具就绪，根目录 ' + root);
}


