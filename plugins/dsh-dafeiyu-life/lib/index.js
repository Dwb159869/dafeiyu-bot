console.log('[dafeiyu-life] module loaded');
// 大肥鱼的生活状态（DSH 版）
// 参考 AstrBot「我会永远陪着你」的状态层：精力、心情、睡眠阶段、余波。
// 做法：时间连续推进 + 每轮把"人话版"状态注入人格提示词 + 给几个可以改状态的工具。
// 状态存在小窝里的 life.db，重启不丢。
import path from 'node:path';
import { defineTool } from '@deepseek-ai/dsh-tools';
import z from '@deepseek-ai/schemastery';
import { MOOD_KINDS, advance, applyEvent, describe, localMinutes, initialState, verbose } from './engine.js';
import { agendaContext, buildAgenda, composeDream, currentItem, dreamContext, localDay, seriesLine } from './agenda.js';
import { blockedBy, buildCandidates, buildProactivePrompt } from './proactive.js';
import { LifeStore } from './store.js';

export const name = 'dafeiyu-life';
export const inject = ['tools'];

export const Config = z.object({
  root: z.string().default('/home/example/dafeiyu-linux/大肥鱼小窝').description('小窝根目录，life.db 放在 04工作区/生活 下'),
  owners: z.array(z.string()).default([]).description('主人 QQ 号'),
  timeZone: z.string().default('Asia/Shanghai').description('按哪个时区判断作息'),
  sleepStart: z.string().default('23:40').description('几点开始睡'),
  sleepEnd: z.string().default('08:10').description('几点醒'),
  presets: z.array(z.string()).default(['companion']).description('只给这些预设的会话注入生活状态'),
  intervalSeconds: z.number().default(60).description('多久推进一次状态（秒）'),
  proactiveEnabled: z.boolean().default(true).description('主动消息：先攒候选、再决定要不要找他'),
  proactiveMinGapMinutes: z.number().default(90).description('两次主动之间至少隔多久（分钟）'),
  proactiveRecentMinutes: z.number().default(40).description('她刚说过话就再等等（分钟）'),
  proactiveCapPerDay: z.number().default(6).description('一天最多主动几次'),
  proactiveKindCooldownHours: z.number().default(6).description('同一种理由隔多久才能再用'),
  proactivePrivate: z.boolean().default(false).description('也主动找别人的私聊'),
  proactiveGroup: z.boolean().default(false).description('也在群里主动说话'),
  proactiveActiveDays: z.number().default(7).description('最近几天聊过的人才主动找'),
  quietStart: z.string().default('01:00').description('免打扰开始'),
  quietEnd: z.string().default('09:00').description('免打扰结束'),
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
const errText = (e) => (e instanceof Error ? e.message : String(e));
const WRAP = new WeakSet();

function wrap(def) {
  const inner = def.execute;
  def.execute = async (args, exec) => {
    try {
      return await inner(args, exec);
    } catch (e) {
      return { ok: false, message: '出错了：' + errText(e) };
    }
  };
  return def;
}

export function apply(ctx, config) {
  console.log('[dafeiyu-life] apply start');
  const log = (level, text) => {
    try {
      ctx.logger(level)('[dafeiyu-life] ' + text);
    } catch {
      /* 日志失败不影响主流程 */
    }
  };
  const settings = {
    timeZone: config.timeZone,
    sleepStart: config.sleepStart,
    sleepEnd: config.sleepEnd,
  };
  const dbFile = path.join(config.root, '04工作区', '生活', 'life.db');
  const store = new LifeStore(dbFile);
  let state = store.load(Date.now()) ?? initialState(Date.now());
  const save = () => {
    try {
      store.save(state);
    } catch (e) {
      log('warn', '写状态失败: ' + errText(e));
    }
  };
  save();

  /** 把状态推进到 now，把跨过的睡眠/醒来记进事件表 */
  const tick = (now = Date.now()) => {    const before = state;
    const { state: next, events } = advance(state, now, settings);
    state = next;
    for (const e of events) {
      try {
        store.record(now, e.kind, e.text, state);
      } catch (err) {
        log('warn', '记事件失败: ' + errText(err));
      }
      if (e.kind === 'wake' || e.kind === 'sleep') log('debug', e.text);
    }
    if (before.lastTick !== state.lastTick) save();
    return state;
  };

  // ---- 日程：给她排一份自己的日子（一天一个），顺手编个昨晚的梦 ----
  const dayOf = (now = Date.now()) => localDay(now, config.timeZone);
  /** 主人最近一条消息，用来给梦找线索 */
  const lastChatText = () => {
    try {
      const rows = store.umos();
      const row = rows.find((r) => r.category === 'master') ?? rows[0];
      return String(row?.last_in_text ?? '');
    } catch {
      return '';
    }
  };
  /**
   * 取今天的安排；没有就排一份（剧集从昨天的进度接着走）。
   * 一天只排一次，之后靠工具改，不会每轮都重排。
   */
  const ensureDay = (now = Date.now()) => {
    const day = dayOf(now);
    const row = store.day(day);
    let agenda = row?.agenda ?? null;
    let series = row?.series ?? null;
    let dream = String(row?.dream ?? '');
    const stale = agenda === null || !Array.isArray(agenda.items) || agenda.day !== day;
    if (stale) {
      const prev = store.recentDays(3).find((r) => r.day !== day && r.series)?.series ?? null;
      const built = buildAgenda(day, { series: prev });
      agenda = { day: built.day, items: built.items };
      series = built.series;
      if (dream === '') dream = composeDream({ lastChat: lastChatText(), series, seed: Number(day.replaceAll('-', '')) });
      store.saveDay(day, { agenda, series, dream });
      log('debug', `排好了 ${day} 的日程：${built.items.length} 项，在追《${series.title}》第 ${series.ep} 集`);
    }
    return { day, agenda, series, dream };
  };
  const saveDay = (patch) => {
    const day = dayOf();
    const cur = ensureDay();
    store.saveDay(day, {
      agenda: patch.agenda ?? cur.agenda,
      series: patch.series ?? cur.series,
      dream: patch.dream ?? cur.dream,
    });
  };

  // ---- 安静地记下谁最近说过话（主动消息要用，不打扰任何流程） ----
  const categoryOf = (umo) => {
    if (umo.includes(':GroupMessage:')) return 'group';
    try {
      const info = ctx.get('napcat')?.sessionInfoByUmo?.(umo);
      if (info?.adminPrivate) return 'master';
    } catch {
      /* 拿不到就按私聊算 */
    }
    return umo.includes(':FriendMessage:') ? 'private' : 'private';
  };
  ctx.on('napcat/message', (abm, event) => {
    try {
      const umo = String(event?.unified_msg_origin ?? '');
      if (umo === '') return;
      const ts = typeof abm?.timestamp === 'number' ? abm.timestamp * 1000 : Date.now();
      store.touchIn(umo, categoryOf(umo), String(abm?.message_str ?? ''), ts);
    } catch (e) {
      log('warn', '记消息时间失败: ' + errText(e));
    }
  });
  ctx.on('napcat/sent', (p) => {
    try {
      const umo = String(p?.umo ?? '');
      if (umo === '') return;
      store.touchOut(umo, p?.time ?? Date.now());
    } catch (e) {
      log('warn', '记发消息时间失败: ' + errText(e));
    }
  });

  const presetOf = (session) =>
    String(session?.header?.agentPreset ?? session?.meta?.agentPreset ?? session?.agentPreset ?? '');

  // ---- 工具：查状态 ----
  const statusTool = wrap(
    defineTool({
      name: 'life_status',
      description: '看大肥鱼现在的精力、心情、睡没睡（详细数字版，只有主人该看）。',
      parameters: {},
      output: { schema: RESULT, render },
      async execute() {
        const now = Date.now();
        tick(now);
        const recent = store.recent(6);
        const lines = [verbose(state, now, settings)];
        if (recent.length > 0) {
          lines.push(
            '最近：\n' +
              recent
                .map((r) => {
                  const t = new Date(r.ts).toLocaleString('zh-CN', { timeZone: settings.timeZone, hour12: false });
                  return `- ${t} ${r.kind}${r.note ? '：' + r.note : ''}`;
                })
                .join('\n'),
          );
        }
        return { ok: true, message: lines.join('\n') };
      },
    }),
  );

  // ---- 工具：记一件事，影响心情 ----
  const eventTool = wrap(
    defineTool({
      name: 'life_event',
      description:
        '给自己记一件有情绪的事，会改变当下的心情和余波。kind 见枚举，intensity 1（一点点）到 5（很强烈），note 写刚才发生了什么。',
      parameters: {
        kind: {
          type: 'string',
          required: true,
          enum: Object.keys(MOOD_KINDS),
          description: Object.entries(MOOD_KINDS)
            .map(([k, v]) => `${k}=${v.name}`)
            .join('，'),
        },
        intensity: { type: 'number', description: '1-5，默认 3' },
        note: { type: 'string', description: '发生了什么（一句话）' },
      },
      output: { schema: RESULT, render },
      async execute(args) {
        const now = Date.now();
        tick(now);
        const kind = String(args.kind ?? 'calm');
        if (!(kind in MOOD_KINDS)) return { ok: false, message: '没这种心情：' + kind };
        const intensity = Number(args.intensity) || 3;
        state = applyEvent(state, kind, intensity, now);
        save();
        store.record(now, 'event:' + kind, String(args.note ?? ''), state);
        log('debug', `心情事件 ${kind} ${intensity}：${args.note ?? ''}`);
        return {
          ok: true,
          message: `记下了（${MOOD_KINDS[kind].name}，强度 ${intensity}）。`,
        };
      },
    }),
  );

  // ---- 工具：手动睡觉/醒来/午睡 ----
  const sleepTool = wrap(
    defineTool({
      name: 'life_sleep',
      description: '改变睡眠阶段：sleep=去睡了，wake=醒了，nap=午睡一会儿（可给 minutes，默认 25）。',
      parameters: {
        action: { type: 'string', required: true, enum: ['sleep', 'wake', 'nap'], description: '动作' },
        minutes: { type: 'number', description: '午睡多少分钟，默认 25' },
      },
      output: { schema: RESULT, render },
      async execute(args) {
        const now = Date.now();
        tick(now);
        const action = String(args.action ?? '');
        if (action === 'sleep') {
          state = { ...state, stage: 'sleeping', stageSince: now, napUntil: 0 };
        } else if (action === 'wake') {
          state = { ...state, stage: 'awake', stageSince: now, napUntil: 0 };
        } else if (action === 'nap') {
          const minutes = Math.max(5, Math.min(90, Number(args.minutes) || 25));
          state = { ...state, stage: 'napping', stageSince: now, napUntil: now + minutes * 60_000 };
        } else {
          return { ok: false, message: 'action 只能是 sleep / wake / nap' };
        }
        state.lastTick = now;
        save();
        store.record(now, 'sleep:' + action, '', state);
        return { ok: true, message: '好，' + (action === 'sleep' ? '去睡了' : action === 'wake' ? '醒了' : '午睡一会儿') + '。' };
      },
    }),
  );

  // ---- 工具：今天的安排（她自己的日子） ----
  const agendaTool = wrap(
    defineTool({
      name: 'life_agenda',
      description:
        '看或改大肥鱼今天自己的安排（几点起床、在做什么、几点追剧第几集）。' +
        'op=list 看今天的；done 把某一项标记完成；add 临时加一件事；skip 表示这件事今天不做了。',
      parameters: {
        op: { type: 'string', required: true, enum: ['list', 'done', 'add', 'skip'], description: '动作' },
        index: { type: 'number', description: 'op=done/skip 时是第几项（从 1 开始，见 list 的编号）' },
        time: { type: 'string', description: 'op=add 时的时间 HH:MM' },
        what: { type: 'string', description: 'op=add 时做什么（一句话）' },
      },
      output: { schema: RESULT, render },
      async execute(args) {
        const op = String(args.op ?? 'list');
        const { agenda, series } = ensureDay();
        const items = agenda.items;
        if (op === 'list') {
          const lines = items.map((it, i) => `${i + 1}. ${it.t} ${it.done ? '√ ' : ''}${it.what}`);
          const tail = series ? '\n' + seriesLine(series) : '';
          return { ok: true, message: `今天（${agenda.day}）：\n${lines.join('\n')}${tail}` };
        }
        if (op === 'done' || op === 'skip') {
          const i = Math.round(Number(args.index)) - 1;
          if (!(i >= 0 && i < items.length)) return { ok: false, message: `没有第 ${args.index} 项，先 list 看一下。` };
          items[i].done = true;
          if (op === 'skip') items[i].skipped = true;
          saveDay({ agenda });
          return { ok: true, message: (op === 'done' ? '做完了：' : '今天不做了：') + items[i].what };
        }
        if (op === 'add') {
          const time = String(args.time ?? '').trim();
          if (!/^\d{1,2}:\d{2}$/.test(time)) return { ok: false, message: 'time 要写成 HH:MM，比如 20:30。' };
          const what = String(args.what ?? '').trim();
          if (what === '') return { ok: false, message: 'what 是空的，写一句要做什么。' };
          items.push({ t: time.padStart(5, '0'), what, kind: 'custom', done: false });
          items.sort((a, b) => a.t.localeCompare(b.t));
          saveDay({ agenda });
          return { ok: true, message: `加上了：${time} ${what}` };
        }
        return { ok: false, message: 'op 只能是 list / done / add / skip。' };
      },
    }),
  );

  // ---- 工具：昨晚的梦 ----
  const dreamTool = wrap(
    defineTool({
      name: 'life_dream',
      description: '看昨晚的梦，或者把它换成自己更想记住的版本（写进"昨晚的梦"，早上第一次聊起时用）。',
      parameters: {
        op: { type: 'string', required: true, enum: ['get', 'set'], description: 'get=看，set=改' },
        text: { type: 'string', description: 'op=set 时新的梦（一两句话）' },
      },
      output: { schema: RESULT, render },
      async execute(args) {
        const op = String(args.op ?? 'get');
        const cur = ensureDay();
        if (op === 'get') {
          if (!cur.dream) return { ok: true, message: '昨晚好像没做什么梦（或者想不起来了）。' };
          return { ok: true, message: `昨晚的梦：${cur.dream}` };
        }
        const text = String(args.text ?? '').trim();
        if (text === '') return { ok: false, message: 'text 是空的。' };
        saveDay({ dream: text.slice(0, 400) });
        return { ok: true, message: '记下了。' };
      },
    }),
  );


  // ---- 主动消息：先出候选，再决定要不要真的叫他 ----
  const DAY = 86_400_000;
  const sticky = new Set();
  const dayKey = (ts) => new Date(ts + 8 * 3600_000).toISOString().slice(0, 10);
  const proactiveSettings = () => ({
    timeZone: config.timeZone,
    quietStart: config.quietStart,
    quietEnd: config.quietEnd,
    minGapMinutes: config.proactiveMinGapMinutes,
    recentMinutes: config.proactiveRecentMinutes,
    capPerDay: config.proactiveCapPerDay,
    kindCooldownHours: config.proactiveKindCooldownHours,
    privateEnabled: config.proactivePrivate,
    groupEnabled: config.proactiveGroup,
  });
  const proactiveTick = async (now = Date.now()) => {
    if (!config.proactiveEnabled) return null;
    tick(now);
    if (state.stage === 'sleeping') return null;
    const wake = ctx.get('napcat')?.wake;
    if (typeof wake !== 'function') return null;
    const s = proactiveSettings();
    const activeDays = Math.max(1, config.proactiveActiveDays) * DAY;
    // 她此刻的日程：刚看完一集剧，正好是个话头
    const dayInfo = ensureDay(now);
    const curItem = currentItem(dayInfo.agenda, now, config.timeZone, localMinutes).now;
    const showTitle = curItem && curItem.kind === 'show' && !curItem.done ? String(dayInfo.series?.title ?? '') : '';
    for (const row of store.umos()) {
      const umo = String(row.umo ?? '');
      if (umo === '' || umo.split(':').pop()?.includes('_')) continue;
      const lastIn = Number(row.last_in ?? 0);
      const lastOut = Number(row.last_out ?? 0);
      if (lastIn > 0 && now - lastIn > activeDays && now - lastOut > activeDays) continue;
      if (sticky.has(umo)) continue;
      const category = String(row.category ?? 'private');
      const firesToday = row.day === dayKey(now) ? Number(row.fires ?? 0) : 0;
      const input = {
        now,
        timeZone: s.timeZone,
        category,
        lastIn,
        lastInText: String(row.last_in_text ?? ''),
        lastOut,
        lastFire: Number(row.last_fire ?? 0),
        firesToday,
        lastKind: String(row.last_kind ?? ''),
        lastKindAt: Number(row.last_kind_at ?? 0),
        life: state,
        showTitle,
      };
      const block = blockedBy(input, s);
      if (block !== undefined) {
        if (block !== '免打扰时间' && block !== '她刚说过话') store.decision(now, umo, 'blocked', 0, false, block);
        continue;
      }
      const cands = buildCandidates(input, s);
      if (cands.length === 0) continue;
      const best = cands[0];
      if (best.score < 0.35) {
        store.decision(now, umo, best.kind, best.score, false, '理由太弱，先不打扰');
        continue;
      }
      sticky.add(umo);
      try {
        const lifeText = describe(state, now, settings).replace(/^现在是[^，]+，/, '');
        const prompt = buildProactivePrompt({
          candidate: best,
          now,
          timeZone: s.timeZone,
          lifeText,
          lastInText: input.lastInText,
          gap: lastIn > 0 ? now - lastIn : 0,
          silenceToken: '[不发]',
          category,
        });
        await wake(umo, [{ type: 'text', text: prompt }]);
        store.fire(umo, best.kind, now);
        store.decision(now, umo, best.kind, best.score, true, best.reason);
        log('info', `主动候选 ${best.kind}(${best.score}) → ${umo}：${best.reason}`);
      } catch (e) {
        store.decision(now, umo, best.kind, best.score, false, '唤醒失败：' + errText(e));
        log('warn', '主动唤醒失败: ' + errText(e));
      } finally {
        sticky.delete(umo);
      }
      return best.kind; // 一轮只主动找一个会话
    }
    return null;
  };

  const proactiveLogTool = wrap(
    defineTool({
      name: 'proactive_log',
      description: '看主动消息最近是怎么判断的：每次为什么找他、为什么没找、分多少。',
      parameters: { limit: { type: 'number', description: '看几条，默认 20' } },
      output: { schema: RESULT, render },
      async execute(args) {
        const rows = store.decisions(Number(args.limit) || 20);
        if (rows.length === 0) return { ok: true, message: '还没有主动消息的判断记录。' };
        const lines = rows.map((r) => {
          const t = new Date(r.ts).toLocaleString('zh-CN', { timeZone: settings.timeZone, hour12: false });
          const who = String(r.umo).split(':').slice(1).join(':');
          return `${t}  ${who}  ${r.kind}  分${r.score}  ${r.fired ? '已唤' : '没唤'}  ${r.note}`;
        });
        return { ok: true, message: lines.join('\n') };
      },
    }),
  );

  // ---- 注入：每轮把状态说给模型听（只对陪伴预设） ----
  ctx.on('system-prompt/assemble', (assembly, context, next) => {
    try {
      const session = context?.agent?.session;
      const preset = presetOf(session);
      if (config.presets.includes(preset) && Array.isArray(assembly?.sections)) {
        const now = Date.now();
        state = tick(now);
        const text = describe(state, now, settings);
        assembly.sections.push({
          name: 'dafeiyu:life',
          text:
            '【你此刻的状态】' +
            text +
            '\n（这是你自己身体的感受，聊天时自然流露就行：累了就短一点、想撒娇就软一点；不要报数字，也不用每句都提。）',
          interpolate: false,
        });
        // 她自己的日子：此刻在做什么、接下来干嘛、昨晚梦见什么
        try {
          const day = ensureDay(now);
          const plan = agendaContext(day.agenda, now, config.timeZone, localMinutes);
          const dream = dreamContext(day.agenda, now, config.timeZone, localMinutes);
          const text = [plan, seriesLine(day.series), dream].filter(Boolean).join('\n');
          if (text !== '') {
            assembly.sections.push({ name: 'dafeiyu:agenda', text, interpolate: false });
          }
        } catch (e) {
          log('warn', '注入日程失败: ' + errText(e));
        }
      }
    } catch (e) {
      log('warn', '注入生活状态失败: ' + errText(e));
    }
    return next();
  });

  // ---- 定时推进 ----
  ctx.effect(() => {
    const ms = Math.max(15, Number(config.intervalSeconds) || 60) * 1000;
    const timer = setInterval(() => {
      try {
        tick(Date.now());
      } catch (e) {
        log('warn', '定时推进失败: ' + errText(e));
      }
    }, ms);
    timer.unref?.();
    const proactiveTimer = setInterval(() => {
      proactiveTick().catch((e) => log('warn', '主动消息出错: ' + errText(e)));
    }, Math.max(60, Number(config.intervalSeconds) || 60) * 2000);
    proactiveTimer.unref?.();
    return () => {
      clearInterval(timer);
      clearInterval(proactiveTimer);
      store.close();
    };
  }, 'dafeiyu-life');

  // ---- 工具注册（照着 dafeiyu-qq-tools 的做法，挂到每个会话） ----
  const defs = [statusTool, eventTool, sleepTool, agendaTool, dreamTool, proactiveLogTool];
  const equipped = new Map();
  const equip = (agent) => {
    if (!agent || equipped.has(agent)) return;
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
    log('debug', '已装备生活状态工具：' + defs.length + ' 个');
    console.log('[dafeiyu-life] tools equipped: ' + defs.length);
  };
  ctx.on('agent/created', (payload) => equip(payload?.agent));
  ctx.effect(() => {
    for (const agent of ctx.get('agents')?.list?.() ?? []) equip(agent);
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
  }, 'dafeiyu-life-tools');

  log('info', 'life ready, db=' + dbFile);
  console.log('[dafeiyu-life] tools ready, db=' + dbFile + ', proactive=' + (config.proactiveEnabled ? 'on' : 'off'));
}
