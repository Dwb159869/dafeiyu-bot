// 大肥鱼的生活状态引擎（纯函数，不碰 IO，方便直接跑测试）
//
// 设计来源：AstrBot 的「我会永远陪着你」里的角色状态（精力/心情/睡眠阶段/疲倦/生活余波）。
// 这里只保留能在 dsh 里真实起作用的部分：
//   - 精力和心情随时间连续变化（不是到点从 100 跳到 0）
//   - 睡眠按作息时间自动进入/醒来，午休是短的
//   - 每件事会留下「余波」，慢慢衰减，而不是立刻生效立刻消失
//   - 对外只说人话，不说数值

export const MOOD_CALM = 55;

const HOUR = 3_600_000;

/** "23:30" -> 1410；空/坏值返回 undefined */
export function parseClock(text) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(text ?? '').trim());
  if (!m) return undefined;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!(h >= 0 && h < 24 && min >= 0 && min < 60)) return undefined;
  return h * 60 + min;
}

/** 现在是不是夜里那段（跨零点也能判断） */
export function inNight(nowMs, startMin, endMin, timeZone) {
  if (startMin === undefined || endMin === undefined || startMin === endMin) return false;
  const min = localMinutes(nowMs, timeZone);
  return startMin < endMin ? min >= startMin && min < endMin : min >= startMin || min < endMin;
}

export function localMinutes(nowMs, timeZone) {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timeZone || undefined,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(nowMs));
    const [h, m] = parts.split(':').map(Number);
    return h * 60 + m;
  } catch {
    const d = new Date(nowMs);
    return d.getHours() * 60 + d.getMinutes();
  }
}

export function clockText(nowMs, timeZone) {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      timeZone: timeZone || undefined,
      month: 'long',
      day: 'numeric',
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(nowMs));
  } catch {
    return new Date(nowMs).toISOString();
  }
}

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const MOOD_KINDS = {
  joy: { name: '被哄开心', delta: 12 },
  touched: { name: '被温暖到', delta: 8 },
  comfort: { name: '被安慰', delta: 7 },
  lonely: { name: '有点想人', delta: -6 },
  tired: { name: '累了', delta: -8 },
  sad: { name: '难过', delta: -12 },
  angry: { name: '生气', delta: -14 },
  worried: { name: '担心', delta: -7 },
  calm: { name: '平复下来', delta: 4 },
};

/** 默认状态 */
export function initialState(nowMs) {
  return {
    energy: 70,
    mood: MOOD_CALM + 4,
    stage: 'awake',
    stageSince: nowMs,
    napUntil: 0,
    lastTick: nowMs,
    echoes: [],
  };
}

/** 空闲时段越晚精力掉得越快一点；夜里没睡就更困 */
function awakeDrainPerHour(nowMs, timeZone) {
  const min = localMinutes(nowMs, timeZone);
  if (min < 6 * 60) return 3.6; // 熬到后半夜，撑不住了
  if (min < 9 * 60) return 2.0; // 刚醒来
  if (min < 13 * 60) return 2.8; // 上午
  if (min < 18 * 60) return 3.3; // 下午最容易困
  if (min < 22 * 60) return 2.4; // 晚上
  return 2.9; // 睡前
}

/** 睡眠里回精力：夜里睡得沉，午睡浅 */
function sleepGainPerHour(stage) {
  return stage === 'napping' ? 7.2 : 9.5;
}

/**
 * 把状态推进到 now。
 * settings: { sleepStart, sleepEnd, timeZone, napMinutes }
 * 返回新状态 + 期间发生的事件（睡下/醒来），调用方负责落库。
 */
export function advance(state, nowMs, settings = {}) {
  const s = { ...state, echoes: Array.isArray(state.echoes) ? state.echoes.map(e => ({ ...e })) : [] };
  const last = Number(s.lastTick);
  const now = Number(nowMs);
  if (!Number.isFinite(last) || now <= last) {
    s.lastTick = Number.isFinite(now) ? now : Date.now();
    return { state: s, events: [] };
  }
  const dtH = Math.min(18, (now - last) / HOUR); // 长时间没跑也不至于一次算飞
  const events = [];
  const tz = settings.timeZone;
  const startMin = parseClock(settings.sleepStart);
  const endMin = parseClock(settings.sleepEnd);
  const napUntil = Number(s.napUntil || 0);

  // 按半小时一段往前走：睡眠阶段在段中间判断，跨过作息边界的瞬间才切换。
  // 之前按整段套用"现在"的阶段，会让睡前的几小时也按睡觉回精力，精力直接算满。
  let cursor = last;
  let stage = s.stage;
  while (cursor < now) {
    let step = Math.min(30 * 60_000, now - cursor);
    if (stage === 'napping' && napUntil > cursor && cursor + step > napUntil) step = napUntil - cursor;
    const mid = cursor + step / 2;
    if (stage === 'napping') {
      if (cursor + step >= napUntil) {
        stage = 'awake';
        events.push({ kind: 'wake', text: '午睡醒来' });
      }
    } else if (inNight(mid, startMin, endMin, tz)) {
      if (stage === 'awake') {
        stage = 'sleeping';
        events.push({ kind: 'sleep', text: '睡着了' });
      }
    } else if (stage === 'sleeping') {
      stage = 'awake';
      events.push({ kind: 'wake', text: '醒了' });
    }
    const h = step / HOUR;
    if (stage === 'sleeping' || stage === 'napping') {
      s.energy += sleepGainPerHour(stage) * h;
    } else {
      s.energy -= awakeDrainPerHour(mid, tz) * h;
    }
    const pull = (stage === 'awake' ? 1.05 : 0.55) * h;
    const gap = MOOD_CALM - s.mood;
    s.mood += Math.abs(gap) <= pull ? gap : Math.sign(gap) * pull;
    cursor += step;
  }
  s.energy = clamp(s.energy, 0, 100);
  s.mood = clamp(s.mood, 0, 100);

  // 余波衰减（按整段时长算一次）
  s.echoes = s.echoes
    .map(e => ({ ...e, ttl: Number(e.ttl) - dtH, delta: Number(e.delta) * Math.max(0, 1 - dtH / 6) }))
    .filter(e => e.ttl > 0 && Math.abs(e.delta) >= 0.4);

  if (stage !== s.stage) s.stageSince = now;
  s.stage = stage;
  s.lastTick = now;
  return { state: s, events };
}

/** 记一件事：给状态加心情余波 */
export function applyEvent(state, kind, intensity = 3, nowMs = Date.now()) {
  const def = MOOD_KINDS[kind] ?? MOOD_KINDS.calm;
  const k = clamp(Number(intensity) || 3, 1, 5) / 3;
  const delta = def.delta * k;
  const s = { ...state, echoes: [...(state.echoes ?? [])] };
  s.mood = clamp(s.mood + delta * 0.6, 0, 100);
  s.echoes.push({ kind, name: def.name, delta: delta * 0.5, ttl: 6, at: nowMs });
  if (s.echoes.length > 12) s.echoes = s.echoes.slice(s.echoes.length - 12);
  if (kind === 'tired' || kind === 'angry' || kind === 'sad') s.energy = clamp(s.energy - 1.5 * k, 0, 100);
  if (kind === 'touched' || kind === 'joy') s.energy = clamp(s.energy + 1.0 * k, 0, 100);
  return s;
}

export function energyLabel(energy) {
  if (energy >= 85) return '精神特别好';
  if (energy >= 68) return '挺有精神';
  if (energy >= 50) return '还行';
  if (energy >= 34) return '有点累';
  if (energy >= 18) return '很疲惫';
  return '快撑不住了';
}

export function moodLabel(mood) {
  if (mood >= 82) return '心情特别好';
  if (mood >= 68) return '心情不错';
  if (mood >= 52) return '心情平静';
  if (mood >= 45) return '有点闷闷的';
  if (mood >= 32) return '心情低落';
  return '很难过';
}

export function stageLabel(stage) {
  if (stage === 'sleeping') return '在睡觉';
  if (stage === 'napping') return '在午睡';
  return '醒着';
}

/** 一句话人话描述，注入提示词用（不带数值） */
export function describe(state, nowMs, settings = {}) {
  const parts = [];
  parts.push('现在是' + clockText(nowMs, settings.timeZone));
  parts.push('你' + stageLabel(state.stage));
  parts.push('精力' + energyLabel(state.energy));
  parts.push(settings.moodText || moodLabel(state.mood));
  const strong = (state.echoes ?? []).filter(e => Math.abs(e.delta) >= 1.2).slice(-2);
  if (strong.length > 0) {
    parts.push('刚才' + strong.map(e => e.name).join('、') + '，还有点余味');
  }
  if (state.energy < 30 && state.stage === 'awake') parts.push('眼皮有点沉');
  if (state.mood < 38) parts.push('不太想说话，但也不想冷落人');
  return parts.join('，') + '。';
}

/** 给主人看的详细数字版 */
export function verbose(state, nowMs, settings = {}) {
  const lines = [
    '现在：' + clockText(nowMs, settings.timeZone),
    '状态：' + stageLabel(state.stage) + '（从 ' + clockText(state.stageSince, settings.timeZone) + '）',
    '精力：' + Math.round(state.energy) + '/100  ' + energyLabel(state.energy),
    '心情：' + Math.round(state.mood) + '/100  ' + moodLabel(state.mood),
  ];
  const e = (state.echoes ?? []).slice(-5);
  if (e.length > 0) lines.push('余波：' + e.map(x => x.name + '（' + x.ttl.toFixed(1) + '小时后散）').join('、'));
  return lines.join('\n');
}
