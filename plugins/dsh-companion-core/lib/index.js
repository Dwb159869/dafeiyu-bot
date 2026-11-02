// dsh-companion-core（插件二）常驻部分：
//   - 人格、核心记忆：挂在 dsh 全局的系统提示词组装环节，QQ 和 dsh 的所有会话每一步都现读；
//   - 她自己改人格/核心记忆的工具：只装在主人的会话里；
//   - 消息存档：从插件一（dsh-napcat-bridge ≥ 0.6.0）的事件收消息；
//   - 给预设里的「上下文管理」行（./context）提供每个会话的规则；
//   - 长期记忆：整理（每 N 轮、压缩前、手动）、召回（每轮放进这一轮的消息里）、主动记忆工具、遗忘、向量索引；
//   - 群聊之前 n 条：通过插件一的 napcat/prompt 把她没看到的群消息一起给她；
//   - 日记和月度总览、主人开新会话时先读日记、存档到期（整理 → 删存档 → 换会话 → 归档/删旧会话）、群消息图片收到时下载；
//   - 设置页（client.js）和它用的接口 <dsh>/api/companion/…（要先登录 dsh 网页）。
import z from '@deepseek-ai/schemastery';
import { join } from 'node:path';
import { Archive } from './archive.js';
import { TextDoc, defaultDataDir, writeAtomic } from './docs.js';
import { applyPrompt, coreBlock } from './prompt.js';
import { listModels } from './models.js';
import { archiveAllowed, archiveRule, contextRule, forgetMode, matchRule, scopeOf } from './rules.js';
import { archivedImage } from './archived-image.js';
import { coreTool, personaTool } from './tools.js';
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import { embed, embedEnabled, Indexer, testEmbed } from './embed.js';
import { DEFAULT_ALLOWED, DEFAULT_FORBIDDEN, guardPersonaEdit, countChars } from './persona-guard.js';
import { GraphBuilder, graphScores, GraphStore } from './graph.js';
import { cleanupPrompt, complete, parseCleanup } from './extract.js';
import { KINDS, MemoryStore, defaultTrust } from './memory.js';
import { forgetTool, saveTool, searchTool } from './memory-tools.js';
import { Organizer } from './organizer.js';
import { formatRecall, recall } from './recall.js';
import { countRounds, isHumanTurn, pendingHumanTurn } from './rounds.js';
import { DiaryStore, diaryBlock, guessDate, localClock, logicalDay } from './diary.js';
import { Maintenance } from './maintenance.js';
import { Proactive } from './proactive.js';
import { Care } from './care.js';
import { applyPendingImport, cleanItems, configuredItems, createBackup, DEFAULT_ITEMS, inspectBackup, ITEMS, itemsOf, listBackups, readSavedSettings, safeBackupName, SETTINGS_ITEMS } from './backup.js';
import { SCHEMA_VERSION } from './archive.js';
import { createReadStream, createWriteStream, renameSync, rmSync, statSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
const mode = (def) => z.union(['truncate', 'llm']).default(def).volatile();
// 每项都 .volatile()：dsh 的设置服务只在线编辑这种字段，保存后插件直接读到新值
export const Config = z.object({
    personaPresets: z.array(z.string()).default(['companion']).volatile().description('生效的预设 id（默认只有陪伴模式；* = 所有预设）。别的插件带来的预设不会被套上人格和记忆'),
    excludedPresets: z.array(z.string()).default([]).volatile().description('不生效的预设 id（例如写代码用的预设）'),
    pluginAccess: z.union(['all', 'public', 'off']).default('all').volatile().description('给其他插件用：all = 人格、核心记忆和记忆都能取（含主人的）；public = 只给公开的；off = 不给'),
    personaOnly: z.boolean().default(true).volatile().description('只用人格：去掉 dsh 的编程助手身份句'),
    selfEdit: z.boolean().default(true).volatile().description('让她能自己改人格和核心记忆（只在主人的会话里）'),
    historyKeep: z.natural().default(5).volatile().description('人格、核心记忆各保留几份历史版本'),
    coreMasterMaxChars: z.natural().min(100).default(5000).volatile().description('主人的核心记忆最多几个字（不算空白；超过后只许变短）'),
    corePublicMaxChars: z.natural().min(100).default(1500).volatile().description('公开的核心记忆最多几个字（不算空白；超过后只许变短）'),
    personaGuard: z.boolean().default(true).volatile().description('限制她改人格时能写什么（字数、日期、数字、链接、隐私、改规则的话）'),
    personaReview: z.boolean().default(true).volatile().description('她改人格前先让模型按下面两张清单审核'),
    personaEditMaxChars: z.natural().min(10).default(300).volatile().description('一次最多加几个字'),
    personaMaxChars: z.natural().min(100).default(15000).volatile().description('人格最多几个字（超过后只许变短）'),
    personaAllowed: z.array(z.string()).default([...DEFAULT_ALLOWED]).volatile().description('人格里可以写什么'),
    personaForbidden: z.array(z.string()).default([...DEFAULT_FORBIDDEN]).volatile().description('人格里不许写什么'),
    thresholdPercent: z.natural().min(10).max(95).default(70).volatile().description('上下文到模型上限的百分之多少就处理'),
    masterMaxRounds: z.natural().default(60).volatile().description('主人：最多保留轮数（0 = 不限）'),
    masterDropRounds: z.natural().min(1).default(20).volatile().description('主人：一次处理几轮'),
    masterMode: mode('llm').description('主人：处理方式'),
    privateMaxRounds: z.natural().default(60).volatile().description('其他私聊：最多保留轮数'),
    privateDropRounds: z.natural().min(1).default(20).volatile().description('其他私聊：一次处理几轮'),
    privateMode: mode('truncate').description('其他私聊：处理方式'),
    groupMaxRounds: z.natural().default(60).volatile().description('群聊：最多保留轮数'),
    groupDropRounds: z.natural().min(1).default(20).volatile().description('群聊：一次处理几轮'),
    groupMode: mode('truncate').description('群聊：处理方式'),
    diaryEffort: z.string().default('high').volatile().description('写日记和月度总览的思考等级（模型用的是和主人私聊用的那个）'),
    summaryModel: z.string().default('').volatile().description('压缩用的 dsh 模型（提供方/模型）'),
    summarySource: z.union(['follow', 'dsh', 'api']).default('follow').volatile().description('follow = 跟随 dsh 配置（用这个会话自己的模型）；dsh = 选 dsh 里配置的模型（summaryModel）；api = 用自己的 Key 调别家（summaryApi*）'),
    summaryEffort: z.string().default('low').volatile().description('思考等级（模型支持时才生效；off / low / medium / high / max，按模型实际支持的来）'),
    summaryApiUrl: z.string().default('').volatile().description('别家的接口地址（OpenAI 兼容，到 /v1）'),
    summaryApiKey: z.string().role('secret').volatile().description('别家的 Key'),
    summaryApiModel: z.string().default('').volatile().description('别家的模型名'),
    rules: z.array(z.object({
        target: z.string(),
        kind: z.union(['user', 'group']).default('user'),
        maxRounds: z.natural(),
        dropRounds: z.natural(),
        mode: z.union(['', 'truncate', 'llm']).default(''),
        archiveDays: z.natural(),
        archiveUnwoken: z.union(['', 'on', 'off']).default(''),
        forgetMode: z.union(['', 'normal', 'purge']).default(''),
        proactive: z.union(['', 'on', 'off']).default(''),
        note: z.string(),
    })).default([]).volatile().description('例外规则：按 QQ 号或群号单独设置'),
    archiveEnabled: z.boolean().default(true).volatile().description('消息存档'),
    archiveUnwoken: z.boolean().default(true).volatile().description('保存没唤醒她的群消息'),
    archiveDaysMaster: z.natural().min(1).default(365).volatile().description('主人私聊存档保留天数'),
    archiveDaysOthers: z.natural().min(1).default(5).volatile().description('其他私聊和群聊存档保留天数'),
    // 记忆召回
    recallEnabled: z.boolean().default(true).volatile().description('每轮自动想起相关的记忆'),
    recallTopK: z.natural().default(6).volatile().description('每轮最多想起几条（别人的私聊和群聊）'),
    recallTopKMaster: z.natural().default(10).volatile().description('每轮最多想起几条（主人的会话：QQ 私聊和 dsh 里的会话）'),
    keywordThreshold: z.number().min(0).max(1).default(0.3).volatile().description('只用关键词时的相关度门槛'),
    vectorThreshold: z.number().min(0).max(1).default(0.45).volatile().description('用向量时的相似度门槛'),
    keywordWeight: z.number().min(0).max(1).default(0.3).volatile().description('用向量时关键词占的比重'),
    importanceWeight: z.number().min(0).max(1).default(0.2).volatile().description('排名时重要程度的权重'),
    recencyWeight: z.number().min(0).max(1).default(0.1).volatile().description('排名时新近程度的权重'),
    groupDiscount: z.number().min(0).max(1).default(0.7).volatile().description('主人会话里群记忆的折扣'),
    halfLifeDays: z.natural().min(1).default(30).volatile().description('重要程度的半衰期（天）'),
    importanceFloor: z.number().min(0).max(1).default(0.12).volatile().description('记忆衰减地板：重要性低于这个值、又只是弱相关时不再注入'),
    floorRelevance: z.number().min(0).max(1).default(0.6).volatile().description('多强的相关才不受衰减地板限制（0.6 = 中等以上相关照样注入）'),
    // 记忆生成
    activeMemory: z.boolean().default(true).volatile().description('主动记忆：给她回忆、记住、遗忘三个工具'),
    organizeEveryRounds: z.natural().default(20).volatile().description('每多少轮整理一次（0 = 不按轮数）'),
    organizeBeforeCompact: z.boolean().default(true).volatile().description('截断/压缩前先整理'),
    memoryModel: z.string().default('').volatile().description('整理记忆（也清理、整合、审核人格）用的 dsh 模型（提供方/模型）'),
    memorySource: z.union(['follow', 'dsh', 'api']).default('follow').volatile().description('follow = 跟随 dsh 配置（dsh 的默认模型）；dsh = 选 dsh 里配置的模型（memoryModel）；api = 用自己的 Key 调别家（memoryApi*）'),
    memoryEffort: z.string().default('low').volatile().description('思考等级（模型支持时才生效；off / low / medium / high / max，按模型实际支持的来）'),
    memoryApiUrl: z.string().default('').volatile().description('别家的接口地址（OpenAI 兼容，到 /v1）'),
    memoryApiKey: z.string().role('secret').volatile().description('别家的 Key'),
    memoryApiModel: z.string().default('').volatile().description('别家的模型名'),
    // 遗忘
    masterForget: z.union(['normal', 'purge']).default('normal').volatile().description('主人的记忆怎么遗忘'),
    privateForget: z.union(['normal', 'purge']).default('purge').volatile().description('别人私聊的记忆怎么遗忘'),
    groupForget: z.union(['normal', 'purge']).default('purge').volatile().description('群聊的记忆怎么遗忘'),
    cleanupEnabled: z.boolean().default(false).volatile().description('主人记忆的模型清理'),
    cleanupAutoPurge: z.boolean().default(false).volatile().description('模型清理判断完直接彻底删除'),
    // 向量检索
    embedApiUrl: z.string().default('https://api.siliconflow.cn/v1').volatile().description('向量接口地址（OpenAI 兼容，到 /v1）'),
    embedApiKey: z.string().role('secret').volatile().description('向量接口 Key；不填不启用向量检索'),
    embedModel: z.string().default('BAAI/bge-m3').volatile().description('向量模型'),
    embedBatch: z.natural().min(1).max(64).default(16).volatile().description('一次算几条'),
    graphEnabled: z.boolean().default(false).volatile().description('图记忆：从记忆里抽出人和事的关系网，召回时多走一路（每条记忆多调一次模型）'),
    graphModel: z.string().default('').volatile().description('抽关系用的 dsh 模型（提供方/模型）'),
    graphSource: z.union(['follow', 'dsh', 'api']).default('follow').volatile().description('follow = 和整理记忆用同一个；dsh = 选 dsh 里配置的模型（graphModel）；api = 用自己的 Key 调别家（graphApi*）'),
    graphEffort: z.string().default('low').volatile().description('思考等级（模型支持时才生效；off / low / medium / high / max，按模型实际支持的来）'),
    graphApiUrl: z.string().default('').volatile().description('别家的接口地址（OpenAI 兼容，到 /v1）'),
    graphApiKey: z.string().role('secret').volatile().description('别家的 Key'),
    graphApiModel: z.string().default('').volatile().description('别家的模型名'),
    graphBatch: z.natural().min(1).max(30).default(8).volatile().description('一次让模型看几条记忆'),
    graphHops: z.natural().max(2).default(1).volatile().description('从提到的东西顺着关系走几步（0–2）'),
    // 群聊上下文
    groupContextCount: z.natural().default(10).volatile().description('参与群话题时附上群里最近几条消息（含她自己说的；图片不限张数；0 = 不附）'),
    // 日记
    diaryEnabled: z.boolean().default(true).volatile().description('每天写日记'),
    diaryTime: z.string().default('01:30').volatile().description('每天几点写日记、处理存档到期（HH:MM）'),
    dayBoundaryHour: z.natural().max(12).default(4).volatile().description('一天按凌晨几点分界'),
    timezone: z.string().default('Asia/Shanghai').volatile().description('时区'),
    monthlyEnabled: z.boolean().default(true).volatile().description('每月写月度总览'),
    diaryOnNewSession: z.boolean().default(true).volatile().description('主人开新会话时先给她看日记'),
    diaryDays: z.natural().default(30).volatile().description('开新会话时给她看最近几天的日记'),
    overviewMonths: z.natural().default(12).volatile().description('开新会话时给她看最近几个月的总览'),
    diaryBudgetPercent: z.natural().min(1).max(60).default(20).volatile().description('这部分最多占模型上限的百分之多少'),
    // 存档到期
    rotateSessions: z.boolean().default(true).volatile().description('会话用满存档保留期就换新会话'),
    deleteOldSessions: z.boolean().default(true).volatile().description('其他人的旧会话过期后删除（主人的永不删）'),
    carryMessages: z.natural().default(10).volatile().description('换会话时带过去最近几条消息'),
    archiveImages: z.boolean().default(true).volatile().description('收到图片时下载存起来（QQ 图片链接会过期）'),
    // 主动聊天（需要 dsh-napcat-bridge ≥ 0.7.0）
    proactiveEnabled: z.boolean().default(true).volatile().description('主动聊天：随机间隔唤醒她，让她决定要不要说话'),
    proactiveMinMinutes: z.natural().min(10).default(60).volatile().description('主人私聊：最短间隔（分钟）'),
    proactiveMaxMinutes: z.natural().min(10).default(240).volatile().description('主人私聊：最长间隔（分钟）'),
    proactiveOthersMinMinutes: z.natural().min(10).default(120).volatile().description('其他私聊和群聊：最短间隔（分钟）'),
    proactiveOthersMaxMinutes: z.natural().min(10).default(240).volatile().description('其他私聊和群聊：最长间隔（分钟）'),
    proactivePrivate: z.boolean().default(true).volatile().description('也主动找别人私聊'),
    proactiveGroup: z.boolean().default(true).volatile().description('也在群里主动说话'),
    quietStart: z.string().default('01:00').volatile().description('免打扰开始（HH:MM）'),
    quietEnd: z.string().default('09:00').volatile().description('免打扰结束（HH:MM）'),
    proactiveRecentMinutes: z.natural().default(30).volatile().description('她这么多分钟内在这个会话里说过话就不触发'),
    proactiveGroupContext: z.natural().default(15).volatile().description('群里主动说话时带几条上下文（图片不限张数）'),
    proactiveActiveDays: z.natural().min(1).default(7).volatile().description('别人和群：最近几天里聊过才主动找'),
    silenceToken: z.string().default('[不发]').volatile().description('「不发」暗号，和 dsh-napcat-bridge 设置里的保持一致'),
    // 记忆保养
    autoCleanup: z.boolean().default(true).volatile().description('自动清理久没想起、不重要的记忆'),
    autoCleanupDays: z.natural().min(1).default(90).volatile().description('超过几天没被想起'),
    autoCleanupImportance: z.number().min(0).max(1).default(0.2).volatile().description('重要程度（衰减后）低于多少'),
    purgeForgotten: z.boolean().default(false).volatile().description('普通遗忘很久的自动彻底遗忘'),
    purgeForgottenDays: z.natural().min(1).default(180).volatile().description('普通遗忘超过几天'),
    consolidateEnabled: z.boolean().default(true).volatile().description('定期整合相近的零散记忆'),
    consolidateOverlap: z.number().min(0.2).max(0.95).default(0.5).volatile().description('相近程度（0–1，越大越严）'),
    consolidateGroups: z.natural().min(1).default(20).volatile().description('一次最多整合几组'),
    careIntervalDays: z.natural().min(1).default(7).volatile().description('清理和整合每几天做一次'),
    // 备份
    backupEnabled: z.boolean().default(true).volatile().description('每天自动备份'),
    backupTime: z.string().default('04:00').volatile().description('自动备份时间（HH:MM）'),
    backupKeep: z.natural().min(1).default(5).volatile().description('每一类备份最多留几份'),
    backupItems: z.array(z.string()).default([...DEFAULT_ITEMS]).volatile().description('备份哪些：' + ITEMS.join(' ') + '（默认除了 sessionsMaster 都备份）'),
    selfCheckQueries: z.array(z.string()).default(['主人叫什么名字', '我们约好了什么', '主人喜欢吃什么']).volatile().description('迁移后自检用的问题'),
    logLevel: z.union(['debug', 'info', 'warn', 'error']).default('info').volatile().description('日志级别'),
});
export const name = 'dsh-companion-core';
const RANK = { debug: 0, info: 1, warn: 2, error: 3 };
const MAX_LOGS = 200;
const errText = (e) => (e instanceof Error ? e.message : String(e));
export async function apply(ctx, live) {
    // 密钥字段不设默认值（设置页才能分清"没设置"和"设成空"），读不到时当空字符串
    const get = (key) => (live[key]?.get() ?? (/ApiKey$/.test(String(key)) ? '' : undefined));
    const logs = [];
    const log = (level, message) => {
        logs.push({ time: Date.now(), level, message });
        if (logs.length > MAX_LOGS)
            logs.splice(0, logs.length - MAX_LOGS);
        if (RANK[level] < RANK[get('logLevel') ?? 'info'])
            return;
        const line = '[companion] ' + message;
        if (level === 'error')
            console.error(line);
        else if (level === 'warn')
            console.warn(line);
        else
            console.log(line);
    };
    const sessionServices = () => ({
        bridge: ctx.get('napcat'),
        persistence: ctx.get('sessionPersistence'),
        attachments: ctx.get('attachments'),
        workspaces: ctx.get('workspaceRegistry'),
    });
    const dir = defaultDataDir();
    const keep = () => get('historyKeep');
    const persona = new TextDoc(join(dir, 'persona', 'persona.md'), join(dir, 'persona', 'history'), keep);
    const personaDoc = persona;
    const coreMaster = new TextDoc(join(dir, 'core', 'master.md'), join(dir, 'core', 'history-master'), keep);
    const corePublic = new TextDoc(join(dir, 'core', 'public.md'), join(dir, 'core', 'history-public'), keep);
    const docs = { persona, 'core-master': coreMaster, 'core-public': corePublic };
    // 导入：上一次在设置页确认导入后，插件重新加载时在这里替换数据（数据库还没打开）
    let lastImport;
    try {
        const imported = await applyPendingImport(dir, keep, sessionServices());
        if (imported !== undefined) {
            lastImport = { manifest: imported.manifest, plan: imported.plan, at: Date.now() };
            log('info', '导入了备份包（' + new Date(imported.manifest.createdAt).toISOString() + ' 做的，还原了：' + imported.plan.items.join('、') + '）');
        }
    }
    catch (e) {
        lastImport = { manifest: undefined, at: Date.now(), error: errText(e) };
        log('error', '导入未完成，待导入包和原会话均已保留：' + errText(e));
    }
    let archive;
    try {
        archive = new Archive(join(dir, 'companion.db'));
    }
    catch (e) {
        log('error', '打不开存档数据库，消息存档暂停：' + errText(e));
    }
    const napcat = () => ctx.get('napcat');
    const scope = (sessionId) => scopeOf(sessionId, napcat());
    /** 这个预设的会话不归插件二管：不在「生效的预设」里（* 表示全部），或在「不生效的预设」里。不知道预设的会话照常管。 */
    const excluded = (presetId) => {
        if (presetId === undefined || presetId === '')
            return false;
        if (get('excludedPresets').map(s => s.trim()).includes(presetId))
            return true;
        const only = get('personaPresets').map(s => s.trim()).filter(Boolean);
        return !(only.length === 0 || only.includes('*') || only.includes(presetId));
    };
    const defaults = () => ({
        context: {
            master: { maxRounds: get('masterMaxRounds'), dropRounds: get('masterDropRounds'), mode: get('masterMode') },
            private: { maxRounds: get('privateMaxRounds'), dropRounds: get('privateDropRounds'), mode: get('privateMode') },
            group: { maxRounds: get('groupMaxRounds'), dropRounds: get('groupDropRounds'), mode: get('groupMode') },
        },
        archive: {
            master: { days: get('archiveDaysMaster'), unwoken: true },
            private: { days: get('archiveDaysOthers'), unwoken: true },
            group: { days: get('archiveDaysOthers'), unwoken: get('archiveUnwoken') },
        },
        forget: { master: get('masterForget'), private: get('privateForget'), group: get('groupForget') },
    });
    const rules = () => (get('rules') ?? []).filter(r => r && String(r.target ?? '').trim() !== '');
    const coreFor = (category) => {
        const pub = corePublic.read().trim();
        if (category !== 'master')
            return pub;
        const own = coreMaster.read().trim();
        return [pub, own].filter(s => s !== '').join('\n\n');
    };
    /** 别的插件要的「给谁」→ 插件二的范围；受「给其他插件用」限制 */
    const pluginTarget = (target) => {
        const access = get('pluginAccess');
        if (access === 'off')
            throw new Error('dsh-companion-core：设置里关掉了「给其他插件用」');
        let s = target?.sessionId ? scope(String(target.sessionId)) : target?.audience === 'master' ? { category: 'master', qq: false } : { category: 'private', qq: true };
        if (access === 'public' && s.category === 'master')
            s = { category: 'private', qq: true };
        return { scope: s, audience: s.category === 'master' ? 'master' : 'public' };
    };
    //#region 给预设里「上下文管理」行的服务
    const service = {
        contextPolicy(sessionId, presetId) {
            if (excluded(presetId))
                return undefined;
            const s = scope(sessionId);
            const summaryModel = taskTarget('summary');
            return { scope: s, rule: contextRule(s, defaults(), rules()), thresholdPercent: get('thresholdPercent'), ...(summaryModel ? { summaryModel } : {}) };
        },
        identity(target) {
            const t = pluginTarget(target);
            const persona = personaDoc.read().trim();
            const core = coreFor(t.scope.category).trim();
            return { persona, core, audience: t.audience, prompt: [persona, core ? coreBlock(core) : ''].filter(Boolean).join('\n\n') };
        },
        async recall(query, options) {
            const t = pluginTarget(options);
            const found = await search(t.scope, String(query ?? ''), Math.max(1, Math.min(20, options?.topK ?? 5)));
            return found.map(f => ({ id: f.memory.id, content: f.memory.content, kind: f.memory.kind, importance: f.memory.importance, relevance: Math.round(f.relevance * 100) / 100, createdAt: f.memory.createdAt }));
        },
        async prompt(options) {
            const t = pluginTarget(options);
            const persona = personaDoc.read().trim();
            const core = coreFor(t.scope.category).trim();
            const query = String(options?.query ?? '').trim();
            const found = query === '' ? [] : await search(t.scope, query, Math.max(1, Math.min(20, options?.topK ?? 5)));
            return [persona, core ? coreBlock(core) : '', found.length > 0 ? formatRecall(found) : ''].filter(Boolean).join('\n\n');
        },
        async remember(content, options) {
            if (memories === undefined)
                return { ok: false, message: '数据库没打开' };
            const by = String(options?.by ?? '').trim();
            if (by === '')
                return { ok: false, message: '要用 by 写明是哪个插件' };
            const t = pluginTarget({ audience: options.audience ?? 'public' });
            const kind = KINDS.includes(String(options.kind)) ? options.kind : 'other';
            const r = memories.add({ scope: t.audience === 'master' ? 'master' : 'public', kind, content: String(content ?? ''), importance: typeof options.importance === 'number' ? options.importance : 0.4, trust: t.audience === 'master' ? 0.7 : 0.4, writer: 'plugin:' + by.slice(0, 40) });
            if (r.action === 'empty')
                return { ok: false, message: '内容是空的' };
            if (r.action === 'blocked')
                return { ok: false, message: '这件事被彻底遗忘过，不再记' };
            afterWrite();
            log('info', '插件 ' + by + ' 替她记了一条（' + t.audience + '）');
            return { ok: true, id: r.id, message: r.action === 'merged' ? '已经记得，加深了印象' : '记住了' };
        },
        async beforeCompact(payload) {
            await ctx.serial('companion/before-compact', payload);
        },
        log,
    };
    ctx.provide('companion', service);
    //#endregion
    //#region 人格、核心记忆：所有会话每一步现读
    ctx.on('system-prompt/assemble', (async (_assembly, context, next) => {
        const assembly = await next();
        const agent = context.agent;
        if (agent === undefined)
            return assembly;
        try {
            if (excluded(agent.session?.meta?.agentPreset))
                return assembly;
            const s = scope(String(agent.session.id));
            return applyPrompt(assembly, { persona: persona.read(), core: coreFor(s.category), personaOnly: get('personaOnly') });
        }
        catch (e) {
            log('warn', '放人格时出错，这一步用 dsh 原来的提示词: ' + errText(e));
            return assembly;
        }
    }));
    //#endregion
    //#region 长期记忆：存储、向量索引、整理、召回
    const memories = archive !== undefined ? new MemoryStore(archive.db) : undefined;
    const meta = {
        get: (key) => archive?.db.prepare('SELECT value FROM meta WHERE key = ?').get(key)?.value,
        set: (key, value) => { archive?.db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value); },
    };
    const embedSettings = () => ({ apiUrl: get('embedApiUrl'), apiKey: get('embedApiKey'), model: get('embedModel'), batch: get('embedBatch') });
    const indexer = memories !== undefined ? new Indexer(memories, embedSettings, meta, log) : undefined;
    const llm = () => ctx.get('llm');
    const parseTarget = (text) => {
        const t = text.trim();
        const slash = t.indexOf('/');
        return slash > 0 && slash < t.length - 1 ? { provider: t.slice(0, slash), model: t.slice(slash + 1) } : undefined;
    };
    /** dsh 的默认模型（网页里选的） */
    const dshDefault = () => {
        const sel = ctx.get('agentDefaultModel')?.currentSelection?.();
        return sel ? { provider: sel.provider, model: sel.model } : undefined;
    };
    /**
     * 压缩 / 整理 / 抽关系各用哪个模型：
     *   follow：跟随 dsh 配置（压缩用会话自己的 → 返回 undefined 由调用方处理；整理用 dsh 默认模型；抽关系和整理用同一个）
     *   dsh：设置里选的 dsh 模型；api：自己的 Key 调别家。
     * 旧版只填了 xxxModel、没有 xxxSource 的，当作 dsh。
     */
    const taskTarget = (task) => {
        const g = (k) => get(k);
        const source = g(task + 'Source');
        const effort = String(g(task + 'Effort') ?? '').trim() || undefined;
        const withEffort = (t) => t === undefined ? undefined : { ...t, ...(t.effort === undefined && effort !== undefined ? { effort } : {}) };
        if (source === 'api') {
            const url = String(g(task + 'ApiUrl') ?? '').trim(), model = String(g(task + 'ApiModel') ?? '').trim();
            if (url !== '' && model !== '')
                return { provider: 'api', model, ...(effort ? { effort } : {}), api: { url, key: String(g(task + 'ApiKey') ?? ''), model, ...(effort ? { effort } : {}) } };
        }
        const configured = parseTarget(get((task + 'Model')));
        if (source === 'dsh' || (source === 'follow' && configured !== undefined)) {
            if (configured !== undefined)
                return withEffort(configured);
        }
        if (task === 'summary')
            return undefined;
        if (task === 'graph')
            return taskTarget('memory');
        return withEffort(dshDefault());
    };
    const modelTarget = () => taskTarget('memory');
    /**
     * 写日记只写关于主人的事，所以用和主人私聊用的模型：dsh-napcat-bridge 里「管理员私聊用的模型」→「私聊用的模型」→ dsh 默认模型
     * （和 dsh-napcat-bridge 自己选模型的顺序一样）。思考等级单独设（diaryEffort，默认 high）。
     */
    const masterChatModel = () => {
        let nb;
        try {
            nb = settingsService()?.describe({ redactSecrets: true }).find(f => formKind(f) === 'napcat-bridge')?.value;
        }
        catch {
            nb = undefined;
        }
        for (const [key, from] of [['adminPrivateModel', 'admin'], ['privateModel', 'private']]) {
            const t = parseTarget(String(nb?.[key] ?? ''));
            if (t !== undefined)
                return { target: t, from };
        }
        const d = dshDefault();
        return d !== undefined ? { target: d, from: 'default' } : { from: 'none' };
    };
    const diaryTarget = () => {
        const m = masterChatModel().target;
        const effort = String(get('diaryEffort') ?? '').trim();
        return m === undefined ? undefined : { ...m, ...(effort ? { effort } : {}) };
    };
    const graphStore = archive !== undefined ? new GraphStore(archive.db) : undefined;
    const graphSettings = () => ({ enabled: get('graphEnabled'), batch: get('graphBatch'), hops: get('graphHops') });
    const graphBuilder = graphStore !== undefined
        ? new GraphBuilder(graphStore, { settings: graphSettings, llm, target: () => taskTarget('graph'), embedSettings, log })
        : undefined;
    const afterWrite = () => { indexer?.ensure(); graphBuilder?.ensure(); };
    const organizer = archive !== undefined && memories !== undefined
        ? new Organizer({ archive, store: memories, llm, target: modelTarget, log, afterWrite })
        : undefined;
    const diary = new DiaryStore(join(dir, 'diary'));
    const mediaDir = join(dir, 'media');
    const carryKey = (umo) => 'carry:' + umo;
    const setCarry = (umo, text) => meta.set(carryKey(umo), text);
    const takeCarry = (umo) => {
        const text = meta.get(carryKey(umo)) ?? '';
        if (text !== '')
            archive?.db.prepare('DELETE FROM meta WHERE key = ?').run(carryKey(umo));
        return text;
    };
    const agentsService = () => ctx.get('agents');
    const maintenance = archive !== undefined && memories !== undefined && organizer !== undefined
        ? new Maintenance({
            archive, store: memories, diary, organizer, llm, target: diaryTarget,
            settings: () => ({
                diaryEnabled: get('diaryEnabled'), monthlyEnabled: get('monthlyEnabled'), boundaryHour: get('dayBoundaryHour'), timeZone: get('timezone'),
                rotateSessions: get('rotateSessions'), deleteOldSessions: get('deleteOldSessions'), carryMessages: get('carryMessages'),
                archiveDays: s => archiveRule(s, defaults(), rules()).days,
            }),
            napcat: () => napcat(),
            registry: () => ctx.get('workspaceRegistry'),
            persistence: () => ctx.get('sessionPersistence'),
            isLive: id => (agentsService()?.list?.() ?? []).some(a => String(a?.session?.id) === id),
            sessionsRoot: join(dirname(dir), 'sessions'),
            mediaDir,
            setCarry,
            log,
        })
        : undefined;
    const clockOk = (v, fallback) => /^\d{1,2}:\d{2}$/.test(v.trim()) ? v.trim().padStart(5, '0') : fallback;
    const proactive = archive !== undefined && organizer !== undefined
        ? new Proactive({
            archive, organizer, mediaDir, meta, log,
            wake: () => napcat()?.wake?.bind(napcat()),
            settings: () => ({
                enabled: get('proactiveEnabled'), masterMinMinutes: get('proactiveMinMinutes'), masterMaxMinutes: get('proactiveMaxMinutes'),
                othersMinMinutes: get('proactiveOthersMinMinutes'), othersMaxMinutes: get('proactiveOthersMaxMinutes'), privateEnabled: get('proactivePrivate'), groupEnabled: get('proactiveGroup'),
                quietStart: clockOk(get('quietStart'), '01:00'), quietEnd: clockOk(get('quietEnd'), '09:00'), recentMinutes: get('proactiveRecentMinutes'),
                groupContextMessages: get('proactiveGroupContext'), activeWithinDays: get('proactiveActiveDays'),
                silenceToken: get('silenceToken') || '[不发]', timeZone: get('timezone'),
                override: s => {
                    const row = matchRule(s, rules());
                    return row?.proactive === 'on' ? true : row?.proactive === 'off' ? false : undefined;
                },
            }),
        })
        : undefined;
    ctx.effect(() => {
        let running = false;
        const timer = setInterval(() => {
            if (proactive === undefined || running)
                return;
            running = true;
            void proactive.tick().catch(e => log('warn', '主动聊天出错：' + errText(e))).finally(() => { running = false; });
        }, 60_000);
        return () => clearInterval(timer);
    }, 'companion: proactive');
    // 每分钟看一眼：到了写日记的时间、今天还没跑过就跑（日记 + 存档到期）
    ctx.effect(() => {
        const tick = () => {
            if (maintenance === undefined || archive === undefined)
                return;
            const now = Date.now();
            const day = logicalDay(now, get('dayBoundaryHour'), get('timezone'));
            if (meta.get('maint:day') === day)
                return;
            const clock = localClock(now, get('timezone'));
            const want = clockOk(get('diaryTime'), '01:30');
            // 写日记的时间在分界之前（比如 1:30 < 4:00）：凌晨那段才算；否则当天到点以后都算
            const boundary = String(get('dayBoundaryHour')).padStart(2, '0') + ':00';
            const due = want < boundary ? clock >= want && clock < boundary : clock >= want || clock < boundary;
            if (!due)
                return;
            meta.set('maint:day', day);
            void maintenance.run(now).then(() => runCare(false, now)).catch(e => log('warn', '每日任务失败：' + errText(e)));
        };
        const timer = setInterval(tick, 60_000);
        return () => clearInterval(timer);
    }, 'companion: daily');
    const care = archive !== undefined && memories !== undefined
        ? new Care({
            db: archive.db, store: memories, llm, target: modelTarget, log,
            settings: () => ({
                cleanupEnabled: get('autoCleanup'), cleanupDays: get('autoCleanupDays'), cleanupImportance: get('autoCleanupImportance'),
                purgeForgottenEnabled: get('purgeForgotten'), purgeForgottenDays: get('purgeForgottenDays'),
                consolidateEnabled: get('consolidateEnabled'), consolidateOverlap: get('consolidateOverlap'), consolidateGroups: get('consolidateGroups'),
                halfLifeDays: get('halfLifeDays'),
                forgetMode: sc => sc === 'master' || sc === 'public' ? forgetMode({ category: 'master', qq: false }, defaults(), rules())
                    : forgetMode(sc.startsWith('group:') ? { category: 'group', qq: true, groupId: sc.slice(6) } : { category: 'private', qq: true, userId: sc.slice(5) }, defaults(), rules()),
            }),
        })
        : undefined;
    /** 清理和整合：到了间隔就做（每天的任务里调用）。 */
    const runCare = async (force = false, now = Date.now()) => {
        if (care === undefined)
            return {};
        const out = {};
        const due = (key) => force || now - Number(meta.get(key) ?? 0) >= get('careIntervalDays') * 86_400_000;
        if (due('care:cleanup')) {
            out.cleanup = care.cleanup(now);
            meta.set('care:cleanup', String(now));
        }
        if (due('care:consolidate')) {
            try {
                out.consolidate = await care.consolidate(now);
            }
            catch (e) {
                out.consolidateError = errText(e);
                log('warn', '定期整合失败：' + errText(e));
            }
            meta.set('care:consolidate', String(now));
        }
        afterWrite();
        return out;
    };
    const backupsDir = join(dir, 'backups');
    const pluginVersion = (() => { try {
        return String(JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8')).version);
    }
    catch {
        return '?';
    } })();
    /** 不含任何 Key 的设置快照 */
    const settingsSnapshot = () => Object.fromEntries(Object.keys(live).filter(k => !/ApiKey$/.test(k)).map(k => [k, live[k]?.get()]));
    const settingsService = () => ctx.get('settings');
    /** 认出两个插件的设置（按自己的字段认，不靠 profile 里的 id） */
    const formKind = (f) => {
        const keys = Object.keys(f.value ?? {});
        if (keys.includes('personaMaxChars') && keys.includes('backupItems'))
            return 'companion-core';
        if (keys.includes('ws_reverse_host') || keys.includes('wakeKeywords'))
            return 'napcat-bridge';
        return 'dsh';
    };
    const captureSettings = () => {
        const forms = settingsService()?.describe({ redactSecrets: true }) ?? [];
        const out = {};
        const dsh = {};
        for (const f of forms) {
            const saved = { ns: f.ns, user: f.user ?? {} };
            const kind = formKind(f);
            if (kind === 'dsh') {
                if (Object.keys(saved.user).length > 0)
                    dsh[f.ns] = saved;
            }
            else
                out[kind] = saved;
        }
        out.dsh = dsh;
        return out;
    };
    /** 把包里的设置套用到现在的 dsh：改过的字段设成包里的值，包里没改过的恢复默认；Key 不动。返回每一份的结果。 */
    const applySettings = async (saved) => {
        const svc = settingsService();
        if (svc === undefined)
            return ['dsh 没有设置服务，设置没套用'];
        const forms = svc.describe({ redactSecrets: true });
        const notes = [];
        const one = async (label, form, s) => {
            if (form === undefined) {
                notes.push(label + '：这台 dsh 里没有，跳过');
                return;
            }
            const secret = new Set((form.secrets ?? []).map(x => x.path[0]));
            const ops = Object.keys(form.value ?? {}).filter(k => !secret.has(k)).flatMap(k => Object.prototype.hasOwnProperty.call(s.user, k) ? [{ op: 'set', path: [k], value: s.user[k] }]
                : form.user !== undefined && Object.prototype.hasOwnProperty.call(form.user, k) ? [{ op: 'unset', path: [k] }] : []);
            try {
                if (ops.length > 0)
                    await svc.mutate(form.ns, ops);
                notes.push(label + '：已套用');
            }
            catch (e) {
                notes.push(label + '：没套用（' + errText(e) + '）');
            }
        };
        if (saved['companion-core'])
            await one('dsh-companion-core 的设置', forms.find(f => formKind(f) === 'companion-core'), saved['companion-core']);
        if (saved['napcat-bridge'])
            await one('dsh-napcat-bridge 的设置', forms.find(f => formKind(f) === 'napcat-bridge'), saved['napcat-bridge']);
        for (const s of Object.values((saved.dsh ?? {})))
            await one('dsh 设置 ' + s.ns, forms.find(f => f.ns === s.ns), s);
        return notes;
    };
    const backupNow = async (reason, items) => {
        if (archive === undefined)
            throw new Error('数据库没打开');
        const es = embedSettings();
        const dim = Number(meta.get('embed_dim:' + es.model.trim()) ?? NaN);
        // 导入前的备份什么都带上，万一要退回去
        const chosen = reason === 'before-import' ? ITEMS.filter(i => i !== 'sessionsMaster' || !!(sessionServices().bridge?.masterPrivateBindings && sessionServices().persistence)) : items ?? configuredItems(get('backupItems'));
        const r = await createBackup({
            dataDir: dir, db: archive.db, outDir: backupsDir, reason, plugin: pluginVersion, schema: SCHEMA_VERSION, settings: settingsSnapshot(),
            embed: { ...(es.model.trim() ? { model: es.model.trim() } : {}), ...(Number.isFinite(dim) ? { dim } : {}) }, keep: get('backupKeep'),
            items: chosen, sessionServices: sessionServices(), settingsFiles: chosen.some(i => SETTINGS_ITEMS.includes(i)) ? captureSettings() : {},
        });
        log('info', '备份好了：' + r.name);
        return r;
    };
    ctx.effect(() => {
        const timer = setInterval(() => {
            if (!get('backupEnabled') || archive === undefined)
                return;
            const now = Date.now();
            const day = logicalDay(now, 0, get('timezone'));
            if (meta.get('backup:day') === day || localClock(now, get('timezone')) < clockOk(get('backupTime'), '04:00'))
                return;
            meta.set('backup:day', day);
            void backupNow('auto').catch(e => log('warn', '自动备份失败：' + errText(e)));
        }, 60_000);
        return () => clearInterval(timer);
    }, 'companion: backup');
    const recallSettings = () => ({
        topK: get('recallTopK'), keywordThreshold: get('keywordThreshold'), vectorThreshold: get('vectorThreshold'),
        keywordWeight: get('keywordWeight'), importanceWeight: get('importanceWeight'), recencyWeight: get('recencyWeight'),
        importanceFloor: get('importanceFloor'), floorRelevance: get('floorRelevance'),
        groupDiscount: get('groupDiscount'), halfLifeDays: get('halfLifeDays'),
    });
    /** 问题的向量（启用了向量检索时）；失败就只用关键词。 */
    const queryVector = async (query) => {
        const es = embedSettings();
        if (!embedEnabled(es))
            return undefined;
        try {
            const [v] = await embed([query], es);
            return { query: v, model: es.model.trim() };
        }
        catch (e) {
            log('debug', '召回时算向量失败，只用关键词：' + errText(e));
            return undefined;
        }
    };
    /** 开了图记忆时，图那一路的分数 */
    const graphFor = (s, query, vec) => {
        if (graphStore === undefined || !get('graphEnabled'))
            return undefined;
        try {
            return graphScores(graphStore, s, query, get('graphHops'), vec);
        }
        catch (e) {
            log('debug', '图记忆检索失败，只用原来那一路：' + errText(e));
            return undefined;
        }
    };
    const search = async (s, query, topK) => {
        if (memories === undefined)
            return [];
        const vec = await queryVector(query);
        const found = recall(memories, s, query, { ...recallSettings(), topK }, vec, Date.now(), graphFor(s, query, vec));
        memories.markRecalled(found.map(f => f.memory.id));
        return found;
    };
    const forgetModeOf = (s) => forgetMode(s, defaults(), rules());
    // 设置页改了向量设置（换模型、填 Key）后自动补算；定时看一眼
    ctx.effect(() => {
        indexer?.ensure();
        graphBuilder?.ensure();
        const timer = setInterval(() => { indexer?.ensure(); graphBuilder?.ensure(); }, 15_000);
        return () => clearInterval(timer);
    }, 'companion: index');
    /** 这个会话的模型上下文窗口（token）；拿不到时按 128K 算。 */
    const contextWindow = async (agent) => {
        try {
            const header = agent.session.requestHeader?.()?.config;
            const provider = header?.provider || agent.options?.provider;
            const model = header?.model || agent.options?.model;
            const info = provider && model ? await llm()?.resolveModelInfo?.(provider, model) : undefined;
            const w = info?.context?.contextWindow;
            return typeof w === 'number' && w > 0 ? w : 128_000;
        }
        catch {
            return 128_000;
        }
    };
    /** 去掉插件一附加的提示，只留人说的话（召回用）。 */
    const queryText = (text) => text.replace(/<system_reminder>[\s\S]*?<\/system_reminder>/g, ' ').replace(/<(Quoted|Forward) Message>[\s\S]*?<\/\1 Message>/g, ' ').trim();
    // 召回：每一轮的第一步，把想起来的记忆作为这一轮的一条消息放进去（不放系统提示词，前面的缓存不受影响）。
    // QQ 会话和 dsh 里的会话都走这里。
    ctx.on('agent/pre-step', (async (payload, next) => {
        const decision = await next();
        try {
            const agent = payload.agent;
            if (memories === undefined || agent === undefined || decision?.kind !== 'enter')
                return decision;
            if (excluded(agent.session?.meta?.agentPreset))
                return decision;
            const human = (payload.messages ?? []).filter(m => isHumanTurn({ type: 'user/message', data: m }));
            if (human.length === 0)
                return decision;
            const s0 = scope(String(agent.session.id));
            // 新会话的第一轮：主人的会话先读日记（和上个会话最后的内容）；其他会话有上个会话的内容就带上
            let opening;
            if (countRounds(agent.session) === 0 && pendingHumanTurn(agent.session)) {
                const carry = s0.umo ? takeCarry(s0.umo) : '';
                let text = '';
                if (s0.category === 'master' && get('diaryOnNewSession')) {
                    const window = await contextWindow(agent);
                    text = diaryBlock(diary.recentMonths(get('overviewMonths')), diary.recentDays(get('diaryDays')), carry, Math.floor(window * get('diaryBudgetPercent') / 100));
                }
                else if (carry !== '') {
                    text = '<previous_session>\n这是上一个会话最后的聊天（会话换新了，接着聊就好，不用提这件事）：\n' + carry + '\n</previous_session>';
                }
                if (text !== '') {
                    opening = createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'plugin:companion-memory' } });
                    log('info', '会话 ' + agent.session.id + ' 是新会话，开头给了' + (s0.category === 'master' ? '日记' : '上个会话的内容') + '（' + text.length + ' 字）');
                }
            }
            const withOpening = opening === undefined ? decision : { ...decision, messages: [opening, ...decision.messages] };
            if (!get('recallEnabled'))
                return withOpening;
            const query = queryText(human.map(m => (Array.isArray(m.content) ? m.content : []).filter((b) => b?.type === 'text').map((b) => String(b.text)).join('\n')).join('\n'));
            if (query === '')
                return withOpening;
            const found = await search(s0, query, s0.category === 'master' ? get('recallTopKMaster') : get('recallTopK'));
            if (found.length === 0)
                return withOpening;
            const text = formatRecall(found);
            log('debug', '会话 ' + agent.session.id + ' 想起了 ' + found.length + ' 条记忆');
            return { ...withOpening, messages: [...withOpening.messages, createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'plugin:companion-memory' } })] };
        }
        catch (e) {
            log('warn', '召回记忆时出错，这一轮不带记忆：' + errText(e));
            return decision;
        }
    }));
    // 整理：截断/压缩之前先把要紧内容写进记忆
    ctx.on('companion/before-compact', (async (p) => {
        if (organizer === undefined || !get('organizeBeforeCompact'))
            return;
        try {
            if (p.scope.qq && p.scope.umo)
                await organizer.organizeUmo(p.scope.umo, '压缩前');
            else if (!p.scope.qq)
                await organizer.flushDsh(p.sessionId, '压缩前', p.transcript);
        }
        catch (e) {
            log('warn', '压缩前整理失败（照常压缩）：' + errText(e));
        }
    }));
    // dsh 里直接开的会话：从会话事件里攒聊天内容，到 N 轮就整理
    ctx.on('session/event', ((session, event) => {
        if (organizer === undefined)
            return;
        const id = String(session?.id ?? '');
        if (id === '' || id.startsWith('napcat-') || excluded(session?.meta?.agentPreset))
            return;
        if (event?.type !== 'user/message' && event?.type !== 'assistant/message')
            return;
        const msg = event.data;
        const human = event.type === 'user/message' && isHumanTurn(event);
        if (event.type === 'user/message' && !human)
            return;
        const text = (Array.isArray(msg?.content) ? msg.content : []).filter((b) => b?.type === 'text').map((b) => String(b.text)).join('\n').trim();
        if (text === '')
            return;
        if (scope(id).qq)
            return;
        organizer.onDshLine(id, text, human, get('organizeEveryRounds'));
    }));
    // 群聊之前 n 条：她参与群话题时，把群里最近 n 条消息（含她自己说的）一起给她，图片不限张数（原图、语音转文字、视频截图都用插件一的媒体服务）
    ctx.on('napcat/prompt', (async (payload) => {
        try {
            const info = payload.info;
            if (archive === undefined || info?.type !== 'group' || get('groupContextCount') <= 0)
                return;
            const s = { category: 'group', qq: true, umo: info.umo, ...(info.groupId ? { groupId: info.groupId } : {}) };
            if (!archiveRule(s, defaults(), rules()).unwoken)
                return;
            const umo = String(info.umo);
            const rows = archive.lastMessages(umo, get('groupContextCount'), payload.message?.message_id !== undefined ? String(payload.message.message_id) : undefined);
            if (rows.length === 0)
                return;
            const media = napcat()?.media;
            const lines = [];
            const images = [];
            for (const r of rows) {
                let extra = '';
                if (r.segments) {
                    try {
                        const all = JSON.parse(r.segments);
                        // 收到时已经下载存好的图片直接用（QQ 链接可能已经过期）
                        const local = Array.isArray(all) ? all.filter((c) => c?.type === 'Image' && typeof c._local === 'string') : [];
                        for (const c of local) {
                            const image = archivedImage(mediaDir, c._local);
                            if (!image)
                                continue;
                            images.push(image);
                            extra += ' [图片，见下面]';
                        }
                        const comps = Array.isArray(all) ? all.filter((c) => !(c?.type === 'Image' && typeof c._local === 'string')) : [];
                        if (media?.convert === undefined)
                            throw new Error('没有 dsh-napcat-bridge 的媒体服务');
                        if (Array.isArray(comps) && comps.some((c) => c?.type === 'Image' || c?.type === 'Record' || c?.type === 'Video')) {
                            const got = await media.convert(comps, Infinity);
                            const imgCount = got.parts.filter((p) => p?.type === 'image').length;
                            if (imgCount > 0)
                                extra += ' [图片×' + imgCount + '，见下面]';
                            if (got.text)
                                extra += ' ' + got.text;
                            images.push(...got.parts);
                        }
                    }
                    catch (e) {
                        log('debug', '群消息里的图片/语音没转出来：' + errText(e));
                    }
                }
                lines.push('[' + (r.direction === 'out' ? '我' : (r.senderName || r.senderId) + '(' + r.senderId + ')') + '] ' + ((r.text || '').trim() || (extra ? '' : '[图片/语音等]')) + extra);
            }
            const head = { type: 'text', text: '<group_context>\n在这条消息之前，群里最近的消息（按时间顺序，[我] 是你自己说的）：\n' + lines.join('\n') + '\n</group_context>' };
            const tail = images.length > 0 ? [{ type: 'text', text: '（下面是上面那些群消息里的图片）' }, ...images] : [];
            payload.content.unshift(head, ...tail);
        }
        catch (e) {
            log('warn', '附带群聊之前的消息时出错：' + errText(e));
        }
    }));
    //#endregion
    //#region 装工具：主人会话里改人格/核心记忆；所有会话（开了主动记忆时）回忆、记住、遗忘
    const toolDeps = {
        persona, coreMaster, corePublic,
        isMaster: sessionId => get('selfEdit') && scope(sessionId).category === 'master',
        coreMaxChars: (which) => which === 'public' ? get('corePublicMaxChars') : get('coreMasterMaxChars'),
        log,
        personaRules: () => ({ allowed: get('personaAllowed'), forbidden: get('personaForbidden') }),
        guardPersona: (current, next, oldText, newText, reason) => guardPersonaEdit({
            settings: () => ({ enabled: get('personaGuard'), review: get('personaReview'), maxEditChars: get('personaEditMaxChars'), maxTotalChars: get('personaMaxChars'), allowed: get('personaAllowed'), forbidden: get('personaForbidden') }),
            llm, target: modelTarget, log,
        }, current, next, oldText, newText, reason),
    };
    const memoryToolDeps = memories === undefined ? undefined : {
        store: memories,
        scope,
        search: async (s, query, limit) => (await search(s, query, limit)).map(f => ({ id: f.memory.id, content: f.memory.content, scope: f.memory.scope, createdAt: f.memory.createdAt })),
        forgetMode: forgetModeOf,
        afterWrite,
        log,
    };
    const equipped = new WeakMap();
    const equip = (agent) => {
        if (agent === undefined || equipped.has(agent))
            return;
        const sessionId = String(agent.session?.id ?? '');
        if (excluded(agent.session?.meta?.agentPreset))
            return;
        const master = scope(sessionId).category === 'master';
        const defs = [
            ...(master ? [personaTool(toolDeps), coreTool(toolDeps)] : []),
            ...(get('activeMemory') && memoryToolDeps !== undefined ? [searchTool(memoryToolDeps), saveTool(memoryToolDeps), forgetTool(memoryToolDeps)] : []),
        ];
        if (defs.length === 0)
            return;
        const tools = agent.ctx?.tools;
        if (tools === undefined) {
            log('warn', '会话 ' + sessionId + ' 没有工具服务，装不了工具');
            return;
        }
        const disposers = [];
        for (const def of defs) {
            try {
                const off = tools.register(def);
                if (typeof off === 'function')
                    disposers.push(off);
            }
            catch (e) {
                log('warn', '会话 ' + sessionId + ' 装工具 ' + def.name + ' 失败: ' + errText(e));
            }
        }
        equipped.set(agent, disposers);
        log('debug', '会话 ' + sessionId + ' 装上了工具：' + defs.map(d => d.name).join('、'));
    };
    ctx.on('agent/created', ((payload) => { equip(payload.agent); }));
    // 插件启动（或重新加载）时，给已经在跑的会话补装
    ctx.effect(() => {
        try {
            for (const agent of ctx.get('agents')?.list?.() ?? [])
                equip(agent);
        }
        catch (e) {
            log('debug', '列出已有会话失败: ' + errText(e));
        }
        return () => {
            for (const agent of ctx.get('agents')?.list?.() ?? []) {
                for (const off of equipped.get(agent) ?? []) {
                    try {
                        off();
                    }
                    catch { /* 会话已经结束 */ }
                }
            }
        };
    }, 'companion: tools');
    //#endregion
    //#region 消息存档（插件一的事件）
    const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' };
    /** 收到的图片下载存好（按内容的 SHA-256 命名），在存档的消息段里记下文件名。 */
    const saveImages = async (umo, messageId, comps, session) => {
        const allowed = () => get('archiveEnabled') && archiveAllowed(napcat(), session);
        const media = napcat()?.media;
        if (media?.loadImage === undefined || archive === undefined)
            return;
        let changed = false;
        for (const c of comps) {
            if (!allowed())
                return;
            if (c?.type !== 'Image' || c._local)
                continue;
            try {
                const img = await media.loadImage(c);
                // 本插件新增：下载期间移出名单或关闭存档，不写文件和数据库。
                if (!allowed())
                    return;
                const bytes = Buffer.from(img.data, 'base64');
                if (bytes.length > 10 * 1024 * 1024)
                    continue;
                const name = createHash('sha256').update(bytes).digest('hex') + '.' + (EXT[img.mediaType] ?? 'jpg');
                mkdirSync(mediaDir, { recursive: true });
                const path = join(mediaDir, name);
                if (!existsSync(path))
                    writeAtomic(path, bytes);
                c._local = name;
                changed = true;
            }
            catch (e) {
                log('debug', '图片没下载下来：' + errText(e));
            }
        }
        if (changed && allowed())
            archive.updateSegments(umo, messageId, JSON.stringify(comps));
    };
    const store = (m) => {
        if (archive === undefined || !get('archiveEnabled'))
            return;
        try {
            archive.add(m);
        }
        catch (e) {
            log('warn', '存档失败: ' + errText(e));
        }
    };
    ctx.on('napcat/message', ((abm, event, isWake) => {
        const umo = String(event?.unified_msg_origin ?? '');
        if (umo === '' || !archiveAllowed(napcat(), event?.session))
            return;
        const isGroup = abm?.type === 'GroupMessage';
        const info = napcat()?.sessionInfoByUmo?.(umo);
        const s = isGroup
            ? { category: 'group', qq: true, groupId: String(abm.raw_message?.group_id ?? abm.group?.group_id ?? abm.session_id ?? '') }
            : { category: info?.adminPrivate ? 'master' : 'private', qq: true, userId: String(abm.session_id ?? abm.sender?.user_id ?? '') };
        if (isGroup || info !== undefined)
            organizer?.rememberCategory(umo, s.category);
        if (isGroup && !isWake && !archiveRule(s, defaults(), rules()).unwoken)
            return;
        const notice = abm?.raw_message?.post_type !== 'message';
        let segments;
        try {
            segments = JSON.stringify(abm.message ?? []);
        }
        catch {
            segments = undefined;
        }
        store({
            umo, kind: isGroup ? 'group' : 'private',
            ...(isGroup ? { groupId: s.groupId } : { userId: s.userId }),
            ...(abm.message_id !== undefined && abm.message_id !== '' ? { messageId: String(abm.message_id) } : {}),
            time: typeof abm.timestamp === 'number' ? abm.timestamp * 1000 : Date.now(),
            direction: 'in',
            senderId: String(abm.sender?.user_id ?? ''),
            senderName: String(abm.sender?.nickname ?? ''),
            woke: isWake, type: notice ? 'notice' : 'message',
            text: notice ? String(abm.event_text ?? abm.message_str ?? '') : String(abm.message_str ?? ''),
            ...(segments !== undefined && !notice ? { segments } : {}),
            ...(info?.sessionId ? { sessionId: info.sessionId } : {}),
        });
        if (get('archiveImages') && get('archiveEnabled') && !notice && abm.message_id !== undefined && Array.isArray(abm.message) && abm.message.some((c) => c?.type === 'Image')) {
            void saveImages(umo, String(abm.message_id), JSON.parse(segments ?? '[]'), event.session);
        }
    }));
    ctx.on('napcat/sent', ((p) => {
        // 本插件新增：回复允许管理员在名单外群发言，但该群的出站消息也不存档。
        if (!archiveAllowed(napcat(), p.session))
            return;
        const isGroup = p.session?.message_type === 'GroupMessage';
        const info = napcat()?.sessionInfoByUmo?.(p.umo);
        if (info !== undefined)
            organizer?.rememberCategory(p.umo, info.type === 'group' ? 'group' : info.adminPrivate ? 'master' : 'private');
        store({
            umo: p.umo, kind: isGroup ? 'group' : 'private',
            ...(isGroup ? { groupId: p.session.session_id } : { userId: p.session.session_id }),
            time: p.time ?? Date.now(), direction: 'out',
            senderId: String(info?.selfId ?? 'self'), senderName: '她',
            woke: true, type: 'message', text: String(p.text ?? ''),
            ...(info?.sessionId ? { sessionId: info.sessionId } : {}),
        });
        // 每 N 轮整理一次（只算她一轮说完的回复）
        if (p.source !== 'service')
            organizer?.onReply(p.umo, get('organizeEveryRounds'));
    }));
    //#endregion
    /** 迁移后自检：用几个固定问题在主人的记忆里搜，看能不能想起来。 */
    const selfCheck = async () => {
        const out = [];
        for (const q of get('selfCheckQueries').filter(x => x.trim() !== '')) {
            const master = { category: 'master', qq: false };
            const vec = memories === undefined ? undefined : await queryVector(q);
            const found = memories === undefined ? [] : recall(memories, master, q, { ...recallSettings(), topK: 3 }, vec, Date.now(), graphFor(master, q, vec));
            out.push({ query: q, found: found.map(f => ({ id: f.memory.id, content: f.memory.content.slice(0, 200), relevance: Math.round(f.relevance * 100) / 100 })) });
        }
        meta.set('selfcheck:last', JSON.stringify({ at: Date.now(), results: out }));
        return out;
    };
    if (lastImport !== undefined && lastImport.error === undefined)
        setTimeout(() => { void selfCheck().catch(() => undefined); }, 3000);
    //#region 设置页用的接口：<dsh>/api/companion/…（挂在 dsh 的 /api 钩子上，要先登录）
    const DOC_NAMES = Object.keys(docs);
    /** 最近一次模型清理的建议（等主人勾选确认） */
    let lastCleanup = null;
    let organizing;
    /** 已解开、等确认的导入包 */
    let pendingInspect;
    const runCleanup = async () => {
        if (memories === undefined)
            throw new Error('数据库没打开');
        const l = llm();
        const target = modelTarget();
        if (l === undefined || target === undefined)
            throw new Error('没有可用的模型');
        const forgotten = memories.list({ scope: 'master', status: 'forgotten', limit: 200 }).items;
        if (forgotten.length === 0)
            return (lastCleanup = { at: Date.now(), suggestions: [], purged: [] });
        const picked = parseCleanup(await complete(l, target, cleanupPrompt(forgotten)), new Set(forgotten.map(m => m.id)));
        const suggestions = picked.map(p => ({ ...p, content: forgotten.find(m => m.id === p.id)?.content ?? '' }));
        const purged = [];
        if (get('cleanupAutoPurge'))
            for (const sug of suggestions)
                if (memories.purge(sug.id))
                    purged.push(sug.id);
        log('info', '模型清理：建议彻底遗忘 ' + suggestions.length + ' 条' + (purged.length > 0 ? '，已直接删除 ' + purged.length + ' 条' : ''));
        return (lastCleanup = { at: Date.now(), suggestions, purged });
    };
    const readBody = (req) => new Promise((resolve, reject) => {
        let size = 0;
        const chunks = [];
        req.on('data', (c) => {
            size += c.length;
            if (size > 4 * 1024 * 1024) {
                reject(new Error('内容太大'));
                req.destroy();
            }
            else
                chunks.push(c);
        });
        req.on('end', () => { try {
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}'));
        }
        catch (e) {
            reject(e);
        } });
        req.on('error', reject);
    });
    const state = () => ({
        dataDir: dir,
        napcat: napcat() !== undefined,
        docs: Object.fromEntries(DOC_NAMES.map(n => [n, { text: docs[n].read(), history: docs[n].history() }])),
        archive: archive?.stats() ?? null,
        memory: memories?.stats() ?? null,
        pending: organizer?.pending() ?? null,
        index: indexer?.state() ?? null,
        graph: graphBuilder === undefined ? null : { ...graphBuilder.state(), sample: graphStore?.sample(15) ?? [] },
        embedKeySet: get('embedApiKey').trim() !== '',
        modelTarget: modelTarget() ?? null,
        cleanup: lastCleanup,
        diary: { days: diary.days().length, months: diary.months().length, latest: diary.days()[0] ?? null, nextDay: meta.get('maint:day') ?? null },
        maintenance: maintenance?.last ?? null,
        retired: archive?.retiredList() ?? [],
        proactive: { list: proactive?.list() ?? [], wakeAvailable: typeof napcat()?.wake === 'function' },
        care: { lastCleanup: Number(meta.get('care:cleanup') ?? 0) || null, lastConsolidate: Number(meta.get('care:consolidate') ?? 0) || null, lastRun: care?.lastRun() ?? null },
        backups: listBackups(backupsDir),
        importing: pendingInspect === undefined ? null : { id: pendingInspect.id, manifest: pendingInspect.manifest },
        lastImport: lastImport === undefined ? null : { at: lastImport.at, error: lastImport.error ?? null, manifest: lastImport.manifest ?? null, plan: lastImport.plan ?? null },
        backupItemsAll: ITEMS,
        selfCheck: (() => { try {
            return JSON.parse(meta.get('selfcheck:last') ?? 'null');
        }
        catch {
            return null;
        } })(),
        logs: logs.slice(-100),
    });
    ctx.on('connection/request', (async (req, res, next) => {
        const path = new URL(req.url ?? '/', 'http://localhost').pathname;
        const at = path.indexOf('/companion/');
        if (at < 0 || !path.slice(0, at).endsWith('/api'))
            return next();
        const parts = path.slice(at + '/companion/'.length).split('/').filter(Boolean);
        const json = (code, value) => {
            res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
            res.end(JSON.stringify(value));
        };
        try {
            if (req.method === 'GET' && parts[0] === 'state')
                return json(200, state());
            const url = new URL(req.url ?? '/', 'http://localhost');
            if (req.method === 'GET' && parts[0] === 'memory' && parts.length === 1) {
                if (memories === undefined)
                    return json(503, { error: '数据库没打开' });
                const status = url.searchParams.get('status');
                return json(200, memories.list({
                    scope: url.searchParams.get('scope') || undefined,
                    status: status === 'forgotten' || status === 'superseded' || status === 'all' ? status : 'active',
                    q: url.searchParams.get('q') || undefined,
                    limit: Number(url.searchParams.get('limit') ?? 50) || 50,
                    offset: Number(url.searchParams.get('offset') ?? 0) || 0,
                }));
            }
            if (req.method === 'GET' && parts[0] === 'index')
                return json(200, indexer?.state() ?? null);
            if (req.method === 'GET' && parts[0] === 'diary') {
                if (parts.length === 1)
                    return json(200, { days: diary.days().map(d => ({ date: d, length: (diary.readDay(d) ?? '').length })), months: diary.months().map(m => ({ date: m, length: (diary.readMonth(m) ?? '').length })) });
                const key = parts[1] ?? '';
                const text = /^\d{4}-\d{2}-\d{2}$/.test(key) ? diary.readDay(key) : /^\d{4}-\d{2}$/.test(key) ? diary.readMonth(key) : undefined;
                return text === undefined ? json(404, { error: '没有这篇' }) : json(200, { date: key, text });
            }
            // 下载备份：GET /backup/file/<名字>
            if (req.method === 'GET' && parts[0] === 'backup' && parts[1] === 'file' && parts[2] && safeBackupName(parts[2])) {
                const file = join(backupsDir, parts[2]);
                if (!existsSync(file))
                    return json(404, { error: '没有这个备份' });
                res.writeHead(200, { 'content-type': 'application/gzip', 'content-length': String(statSync(file).size), 'content-disposition': 'attachment; filename="' + parts[2] + '"', 'cache-control': 'no-store' });
                await pipeline(createReadStream(file), res);
                return;
            }
            // 上传备份包：POST /backup/upload，原始字节，要带 x-companion-upload: 1（跨站表单带不了这个头）
            if (parts[0] === 'backup' && parts[1] === 'upload') {
                if (req.method !== 'POST' || req.headers['x-companion-upload'] !== '1')
                    return json(400, { error: '上传方式不对' });
                mkdirSync(backupsDir, { recursive: true });
                const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
                const file = join(backupsDir, '.upload-' + id + '.tar.gz');
                let size = 0;
                req.on('data', (c) => { size += c.length; if (size > 2 * 1024 * 1024 * 1024)
                    req.destroy(new Error('文件太大')); });
                await pipeline(req, createWriteStream(file));
                try {
                    const r = await inspectBackup(file, join(dir, '.import-' + id));
                    pendingInspect = { id, dir: r.dir, manifest: r.manifest };
                    return json(200, state());
                }
                finally {
                    rmSync(file, { force: true });
                }
            }
            if (parts[0] === 'proactive' && parts[1] === 'try') {
                if (req.method !== 'POST')
                    return json(405, { error: '只支持 POST' });
                if (!String(req.headers['content-type'] ?? '').includes('application/json'))
                    return json(415, { error: '需要 application/json' });
                const body = await readBody(req);
                const target = proactive?.scopeForUmo(String(body?.umo ?? ''));
                if (proactive === undefined || target === undefined)
                    return json(404, { error: '没有这个会话' });
                const ok = await proactive.fire(String(body.umo), target);
                return ok ? json(200, state()) : json(500, { error: '唤醒失败，看日志' });
            }
            // 测试用：端到端测试调给其他插件的接口（只在测试环境开）
            if (parts[0] === 'test' && parts[1] === 'service' && process.env.COMPANION_TEST_CLOCK === '1') {
                const body = await readBody(req);
                try {
                    if (body?.op === 'identity')
                        return json(200, service.identity(body.target));
                    if (body?.op === 'recall')
                        return json(200, await service.recall(String(body.query ?? ''), body.target));
                    if (body?.op === 'prompt')
                        return json(200, { text: await service.prompt(body.target) });
                    if (body?.op === 'remember')
                        return json(200, await service.remember(String(body.content ?? ''), body.options));
                }
                catch (e) {
                    return json(400, { error: errText(e) });
                }
                return json(404, { error: 'op?' });
            }
            if (parts[0] === 'proactive' && parts[1] === 'tick' && process.env.COMPANION_TEST_CLOCK === '1') {
                const body = await readBody(req);
                const woken = await proactive?.tick(typeof body?.now === 'number' ? body.now : Date.now());
                return json(200, { woken: woken ?? [] });
            }
            if (['backup', 'care', 'selfcheck'].includes(parts[0] ?? '')) {
                if (req.method !== 'POST')
                    return json(405, { error: '只支持 POST' });
                if (!String(req.headers['content-type'] ?? '').includes('application/json'))
                    return json(415, { error: '需要 application/json' });
                const body = await readBody(req);
                if (parts[0] === 'selfcheck')
                    return json(200, { results: await selfCheck() });
                if (parts[0] === 'care') {
                    if (parts[1] === 'run')
                        return json(200, { report: await runCare(true), state: state() });
                    if (parts[1] === 'undo')
                        return json(200, { undone: care?.undoLast() ?? 0, state: state() });
                    return json(404, { error: 'not found' });
                }
                // backup
                if (parts[1] === 'create') {
                    const r = await backupNow('manual', Array.isArray(body?.items) ? cleanItems(body.items) : undefined);
                    return json(200, { name: r.name, state: state() });
                }
                if (parts[1] === 'delete') {
                    const name = String(body?.name ?? '');
                    if (!safeBackupName(name))
                        return json(400, { error: '名字不对' });
                    rmSync(join(backupsDir, name), { force: true });
                    return json(200, state());
                }
                if (parts[1] === 'restore') {
                    const name = String(body?.name ?? '');
                    if (!safeBackupName(name) || !existsSync(join(backupsDir, name)))
                        return json(404, { error: '没有这个备份' });
                    const id = Date.now().toString(36);
                    const r = await inspectBackup(join(backupsDir, name), join(dir, '.import-' + id));
                    pendingInspect = { id, dir: r.dir, manifest: r.manifest };
                    return json(200, state());
                }
                if (parts[1] === 'cancel') {
                    if (pendingInspect)
                        rmSync(pendingInspect.dir, { recursive: true, force: true });
                    pendingInspect = undefined;
                    return json(200, state());
                }
                if (parts[1] === 'confirm') {
                    if (pendingInspect === undefined || pendingInspect.id !== String(body?.id ?? ''))
                        return json(409, { error: '没有等确认的导入，或者已经过期，请重新上传' });
                    // 要还原哪些：没给就是包里全部
                    const items = (Array.isArray(body?.items) ? cleanItems(body.items) : itemsOf(pendingInspect.manifest)).filter(i => itemsOf(pendingInspect.manifest).includes(i));
                    if (items.length === 0)
                        return json(400, { error: '一样都没勾' });
                    // 先自动备份当前全部数据；设置马上套用；文件和数据库放到待导入的位置，插件重新加载时按勾选替换
                    await backupNow('before-import');
                    const notes = await applySettings(readSavedSettings(pendingInspect.dir, items));
                    writeFileSync(join(pendingInspect.dir, 'restore.json'), JSON.stringify({ items, notes }));
                    rmSync(join(dir, '.pending-import'), { recursive: true, force: true });
                    renameSync(pendingInspect.dir, join(dir, '.pending-import'));
                    pendingInspect = undefined;
                    log('info', '确认导入，插件马上重新加载');
                    json(200, { ok: true, restarting: true });
                    setTimeout(() => { void ctx.fiber?.restart?.(); }, 300);
                    return;
                }
                return json(404, { error: 'not found' });
            }
            if (['diary', 'maintenance'].includes(parts[0] ?? '')) {
                if (req.method !== 'POST')
                    return json(405, { error: '只支持 POST' });
                if (!String(req.headers['content-type'] ?? '').includes('application/json'))
                    return json(415, { error: '需要 application/json' });
                const body = await readBody(req);
                if (parts[0] === 'maintenance') {
                    if (maintenance === undefined)
                        return json(503, { error: '数据库没打开' });
                    // 测试用：环境变量 COMPANION_TEST_CLOCK=1 时可以指定"现在"（模拟过了很多天）
                    const now = process.env.COMPANION_TEST_CLOCK === '1' && typeof body?.now === 'number' ? body.now : Date.now();
                    const what = body?.what === 'diary' || body?.what === 'expire' ? body.what : 'all';
                    const report = await maintenance.run(now, what);
                    return json(200, { report, state: state() });
                }
                // diary
                if (parts[1] === 'import') {
                    const files = Array.isArray(body?.files) ? body.files : [];
                    const conflict = body?.conflict === 'overwrite' || body?.conflict === 'merge' ? body.conflict : 'skip';
                    const results = [];
                    for (const f of files.slice(0, 400)) {
                        const name = String(f.name ?? '');
                        const text = String(f.text ?? '').trim();
                        const date = guessDate(name, text);
                        if (date === undefined || text === '') {
                            results.push({ name, result: 'no-date' });
                            continue;
                        }
                        const existing = diary.readDay(date);
                        if (existing !== undefined && conflict === 'skip') {
                            results.push({ name, date, result: 'skipped' });
                            continue;
                        }
                        const content = existing !== undefined && conflict === 'merge' ? existing.trim() + '\n\n' + text : text;
                        diary.writeDay(date, content);
                        memories?.add({ scope: 'master', kind: 'diary', content, importance: 0.8, trust: 1, writer: 'import' });
                        results.push({ name, date, result: existing !== undefined ? conflict : 'added' });
                    }
                    afterWrite();
                    log('info', '导入日记 ' + results.filter(r => r.result !== 'skipped' && r.result !== 'no-date').length + ' 篇');
                    return json(200, { results });
                }
                const key = parts[1] ?? '';
                const isDay = /^\d{4}-\d{2}-\d{2}$/.test(key);
                const isMonth = /^\d{4}-\d{2}$/.test(key);
                if (!isDay && !isMonth)
                    return json(400, { error: '日期格式不对' });
                if (parts[2] === 'delete') {
                    const ok = isDay ? diary.deleteDay(key) : diary.deleteMonth(key);
                    if (ok)
                        log('info', '设置页删除了 ' + key + ' 的日记');
                    return json(ok ? 200 : 404, { ok });
                }
                if (typeof body?.text !== 'string' || body.text.trim() === '')
                    return json(400, { error: '内容是空的' });
                if (isDay)
                    diary.writeDay(key, body.text);
                else
                    diary.writeMonth(key, body.text);
                log('info', '设置页修改了 ' + key + ' 的日记');
                return json(200, { ok: true });
            }
            // 设置页「测试」向量接口：POST /embed/test（用保存过的设置）
            // 设置页「获取模型列表」：POST /embed/models { apiUrl?, apiKey?, query? }（没给的用保存过的；Key 只在这次请求里用，不保存）
            // 设置页选模型：GET /llm/dsh-models（dsh 里配置的模型）；POST /llm/efforts { task?, provider?, model? }（这个模型能选哪些思考等级）；
            // POST /llm/models { task, apiUrl?, apiKey? }（别家的模型列表）；POST /llm/test { task }（用保存过的设置让模型回一句话）
            if (parts[0] === 'llm') {
                const l = llm();
                if (parts[1] === 'dsh-models' && req.method === 'GET') {
                    if (l === undefined)
                        return json(200, { providers: [], default: null });
                    const providers = [];
                    for (const p of (l.listProviders?.() ?? [])) {
                        let models = [];
                        try {
                            models = (await l.listModels(p.id)).map(m => ({ id: m.id, name: m.name || m.id }));
                        }
                        catch {
                            models = [];
                        }
                        providers.push({ id: p.id, name: p.name || p.id, models });
                    }
                    return json(200, { providers, default: dshDefault() ?? null });
                }
                if (req.method !== 'POST')
                    return json(405, { error: '只支持 POST' });
                if (!String(req.headers['content-type'] ?? '').includes('application/json'))
                    return json(415, { error: '需要 application/json' });
                const body = await readBody(req);
                const task = ['summary', 'memory', 'graph', 'diary'].includes(String(body?.task)) ? String(body.task) : 'memory';
                if (parts[1] === 'efforts') {
                    // 给了 provider/model 就查它；没给就查这个任务「跟随 dsh 配置」时会用的模型
                    const t = typeof body?.provider === 'string' && typeof body?.model === 'string' && body.provider && body.model ? { provider: body.provider, model: body.model } : (task === 'diary' ? masterChatModel().target : task === 'summary' ? dshDefault() : taskTarget(task === 'graph' ? 'memory' : task));
                    if (l === undefined || t === undefined || t.api !== undefined)
                        return json(200, { efforts: [], model: t ?? null });
                    try {
                        const info = await l.resolveModelInfo(t.provider, t.model);
                        return json(200, { efforts: (info?.reasoning?.efforts ?? []).map((e) => ({ id: String(e.id), name: String(e.name ?? e.id) })), defaultEffort: info?.reasoning?.defaultEffort ?? null, model: { provider: t.provider, model: t.model }, ...(task === 'diary' ? { from: masterChatModel().from } : {}) });
                    }
                    catch (e) {
                        return json(200, { efforts: [], error: errText(e), model: { provider: t.provider, model: t.model } });
                    }
                }
                if (parts[1] === 'models' && task !== 'diary') {
                    const url = typeof body?.apiUrl === 'string' && body.apiUrl.trim() ? body.apiUrl : String(get((task + 'ApiUrl')) ?? '');
                    const key = typeof body?.apiKey === 'string' && body.apiKey.trim() ? body.apiKey : String(get((task + 'ApiKey')) ?? '');
                    return json(200, await listModels(url, key, 'chat', ''));
                }
                if (parts[1] === 'test') {
                    const t = task === 'diary' ? diaryTarget() : task === 'summary' ? (taskTarget('summary') ?? dshDefault()) : taskTarget(task);
                    if (t === undefined)
                        return json(200, { ok: false, error: '没有可用的模型' });
                    const l2 = llm();
                    if (t.api === undefined && l2 === undefined)
                        return json(200, { ok: false, error: 'dsh 的模型服务没准备好' });
                    const start = Date.now();
                    try {
                        const text = await complete(l2, t, '这是连通性测试，请只回一个字：好', 2048);
                        return json(200, { ok: true, model: (t.api ? t.api.url.replace(/^https?:\/\//, '').split('/')[0] + ' · ' : t.provider + '/') + t.model, effort: t.effort ?? null, ms: Date.now() - start, text: text.trim().slice(0, 40) });
                    }
                    catch (e) {
                        return json(200, { ok: false, error: errText(e) });
                    }
                }
                return json(404, { error: 'not found' });
            }
            if (parts[0] === 'embed' && parts[1] === 'models') {
                if (req.method !== 'POST')
                    return json(405, { error: '只支持 POST' });
                if (!String(req.headers['content-type'] ?? '').includes('application/json'))
                    return json(415, { error: '需要 application/json' });
                const body = await readBody(req);
                const es = embedSettings();
                const url = typeof body?.apiUrl === 'string' && body.apiUrl.trim() ? body.apiUrl : es.apiUrl;
                const key = typeof body?.apiKey === 'string' && body.apiKey.trim() ? body.apiKey : es.apiKey;
                return json(200, await listModels(url, key, 'embedding', typeof body?.query === 'string' ? body.query : ''));
            }
            if (parts[0] === 'embed' && parts[1] === 'test') {
                if (req.method !== 'POST')
                    return json(405, { error: '只支持 POST' });
                if (!String(req.headers['content-type'] ?? '').includes('application/json'))
                    return json(415, { error: '需要 application/json' });
                return json(200, await testEmbed(embedSettings()));
            }
            if (['memory', 'index', 'graph', 'organize', 'cleanup'].includes(parts[0] ?? '')) {
                if (req.method !== 'POST')
                    return json(405, { error: '只支持 POST' });
                if (!String(req.headers['content-type'] ?? '').includes('application/json'))
                    return json(415, { error: '需要 application/json' });
                const body = await readBody(req);
                if (parts[0] === 'organize') {
                    if (organizer === undefined)
                        return json(503, { error: '数据库没打开' });
                    if (organizing === undefined)
                        organizing = organizer.organizeAll().then(r => { log('info', '手动整理完成：' + r.sessions + ' 个会话，新记了 ' + r.added + ' 条'); }, e => { log('warn', '手动整理失败：' + errText(e)); }).finally(() => { organizing = undefined; });
                    if (body?.wait === true)
                        await organizing;
                    return json(200, state());
                }
                if (parts[0] === 'cleanup') {
                    if (!get('cleanupEnabled'))
                        return json(400, { error: '先在设置里打开「模型清理」' });
                    if (parts[1] === 'purge') {
                        const ids = Array.isArray(body?.ids) ? body.ids.map(Number).filter(Number.isInteger) : [];
                        const allowed = new Set((lastCleanup?.suggestions ?? []).map(x => x.id));
                        const done = ids.filter(id => allowed.has(id) && memories?.purge(id));
                        if (lastCleanup)
                            lastCleanup = { ...lastCleanup, purged: [...lastCleanup.purged, ...done] };
                        log('info', '设置页确认彻底遗忘 ' + done.length + ' 条');
                        return json(200, state());
                    }
                    await runCleanup();
                    return json(200, state());
                }
                if (parts[0] === 'graph') {
                    if (graphBuilder === undefined)
                        return json(503, { error: '数据库没打开' });
                    if (parts[1] === 'rebuild')
                        graphBuilder.start(true);
                    else if (parts[1] === 'resume')
                        graphBuilder.start(false);
                    else if (parts[1] === 'pause')
                        graphBuilder.pause();
                    else if (parts[1] === 'cancel')
                        graphBuilder.cancel();
                    else
                        return json(404, { error: 'not found' });
                    return json(200, state());
                }
                if (parts[0] === 'index') {
                    if (indexer === undefined)
                        return json(503, { error: '数据库没打开' });
                    if (parts[1] === 'rebuild')
                        indexer.start(true);
                    else if (parts[1] === 'resume')
                        indexer.start(false);
                    else if (parts[1] === 'pause')
                        indexer.pause();
                    else if (parts[1] === 'cancel')
                        indexer.cancel();
                    else
                        return json(404, { error: 'not found' });
                    return json(200, indexer.state());
                }
                // memory
                if (memories === undefined)
                    return json(503, { error: '数据库没打开' });
                if (parts[1] === 'add') {
                    const scopeName = String(body?.scope ?? 'master');
                    if (!/^(master|public|group:\d+|user:\d+)$/.test(scopeName))
                        return json(400, { error: '归属不对' });
                    const kind = KINDS.includes(String(body?.kind)) ? body.kind : 'other';
                    const r = memories.add({ scope: scopeName, kind, content: String(body?.content ?? ''), importance: Number(body?.importance ?? 0.6), trust: defaultTrust('master', 'settings'), writer: 'settings' });
                    afterWrite();
                    return json(200, r);
                }
                const id = Number(parts[1]);
                if (!Number.isInteger(id) || memories.get(id) === undefined)
                    return json(404, { error: '没有这条记忆' });
                const action = parts[2];
                const ok = action === 'forget' ? memories.forget(id)
                    : action === 'purge' ? memories.purge(id)
                        : action === 'restore' ? memories.restore(id)
                            : action === 'edit' ? memories.edit(id, String(body?.content ?? ''))
                                : undefined;
                if (ok === undefined)
                    return json(404, { error: 'not found' });
                if (action === 'edit' || action === 'restore')
                    afterWrite();
                log('info', '设置页对记忆 #' + id + ' 做了 ' + action);
                return json(ok ? 200 : 400, { ok });
            }
            if (parts[0] === 'doc' && DOC_NAMES.includes(parts[1] ?? '')) {
                const doc = docs[parts[1]];
                if (req.method === 'GET' && parts[2] === 'version' && parts[3]) {
                    const text = doc.version(parts[3]);
                    return text === undefined ? json(404, { error: '没有这个版本' }) : json(200, { text });
                }
                if (req.method !== 'POST')
                    return json(405, { error: '只支持 POST' });
                // 要求 JSON 请求：跨站表单提交带不了这个类型，防止别的网页借你的登录改人格
                if (!String(req.headers['content-type'] ?? '').includes('application/json'))
                    return json(415, { error: '需要 application/json' });
                if (parts[2] === 'restore' && parts[3]) {
                    const ok = doc.restore(parts[3]);
                    if (ok)
                        log('info', '设置页把' + parts[1] + '回退到 ' + parts[3]);
                    return ok ? json(200, state()) : json(404, { error: '没有这个版本' });
                }
                const body = await readBody(req);
                if (typeof body?.text !== 'string')
                    return json(400, { error: '缺少 text' });
                if (parts[1] !== 'persona') {
                    const max = parts[1] === 'core-public' ? get('corePublicMaxChars') : get('coreMasterMaxChars');
                    if (countChars(body.text) > max)
                        return json(400, { error: '超过核心记忆上限（' + countChars(body.text) + ' 字 > ' + max + ' 字）' });
                }
                doc.write(body.text, { by: 'settings' });
                log('info', '设置页修改了 ' + parts[1]);
                return json(200, state());
            }
            return json(404, { error: 'not found' });
        }
        catch (e) {
            return json(500, { error: errText(e) });
        }
    }));
    //#endregion
    // 自带设置页（client.js），告诉 dsh 不用按 schema 自动生成表单
    ctx.inject(['settings'], child => {
        child.effect(() => child.settings.configure({ auto: false }, ctx.fiber), 'companion: settings policy');
    });
    ctx.effect(() => () => { archive?.close(); }, 'companion: archive');
}
