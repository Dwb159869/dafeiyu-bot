// 主动消息的「候选生命周期」：先在脑子里想清楚为什么要找他，再决定说不说。
//
// 和 companion-core 内置随机唤醒的区别：
//   - 不是到点就叫，而是先攒候选（想念、担心、累、分享、到饭点了…）
//   - 每个候选带理由和权重，同一类理由有冷却，避免反复用同一个借口
//   - 免打扰、刚说过话、今天说太多 → 直接不出候选
//   - 唤醒时把「为什么想找他」告诉模型，让它接着这个理由说，而不是空泛地"找主人聊点什么"
// 本文件只做纯计算，发消息、落库都在调用方。

const MINUTE = 60_000;
const HOUR = 3_600_000;

const CARE_RE = /(累|忙死|加班|熬夜|没睡|睡不着|难受|不舒服|生病|发烧|疼|压力|烦|焦虑|委屈|被骂|吵架|不开心|低落|emo)/i;

/** 本地小时（带小数），用于判断饭点/深夜 */
export function localHour(now, timeZone) {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timeZone || undefined,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(now));
    const [h, m] = parts.split(':').map(Number);
    return h + m / 60;
  } catch {
    const d = new Date(now);
    return d.getHours() + d.getMinutes() / 60;
  }
}

export function inQuiet(now, quietStart, quietEnd, timeZone) {
  if (!quietStart || !quietEnd || quietStart === quietEnd) return false;
  const min = localHour(now, timeZone) * 60;
  const toMin = (t) => {
    const [h, m] = String(t).split(':').map(Number);
    return h * 60 + (m || 0);
  };
  const a = toMin(quietStart);
  const b = toMin(quietEnd);
  return a < b ? min >= a && min < b : min >= a || min < b;
}

export function gapText(ms) {
  const minutes = Math.round(ms / MINUTE);
  if (minutes < 60) return minutes + ' 分钟';
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return hours + ' 小时' + (minutes % 60 > 0 ? ' ' + (minutes % 60) + ' 分钟' : '');
  return Math.floor(hours / 24) + ' 天';
}

export function clockText(now, timeZone) {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      timeZone: timeZone || undefined,
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'long',
      hour12: false,
    }).format(new Date(now));
  } catch {
    return new Date(now).toISOString();
  }
}

/** 硬闸门：这些情况连候选都不用生成 */
export function blockedBy(input, s) {
  const { now, lastOut, lastFire, firesToday, category } = input;
  if (inQuiet(now, s.quietStart, s.quietEnd, s.timeZone)) return '免打扰时间';
  if (lastOut > 0 && now - lastOut < (s.recentMinutes ?? 30) * MINUTE) return '她刚说过话';
  if (lastFire > 0 && now - lastFire < (s.minGapMinutes ?? 60) * MINUTE) return '距上次主动还太近';
  if (firesToday >= (s.capPerDay ?? 6)) return '今天主动次数够了';
  if (category === 'group' && !s.groupEnabled) return '群聊主动关着';
  if (category !== 'master' && category !== 'group' && !s.privateEnabled) return '别人的私聊主动关着';
  return undefined;
}

/**
 * 生成候选，按分数从高到低。
 * input: { now, timeZone, category, lastIn, lastInText, lastOut, lastFire, firesToday, lastKind, lastKindAt, life }
 * s: { minGapMinutes, recentMinutes, quietStart, quietEnd, capPerDay, kindCooldownHours, groupEnabled, privateEnabled }
 */
export function buildCandidates(input, s = {}) {
  const out = [];
  const { now, life = {}, lastInText = '', lastIn = 0, lastOut = 0, lastKind = '', lastKindAt = 0 } = input;
  const hour = localHour(now, s.timeZone);
  const gap = lastIn > 0 ? now - lastIn : 0;
  const cooldown = (s.kindCooldownHours ?? 6) * HOUR;
  const push = (kind, score, reason) => {
    if (lastKind === kind && now - lastKindAt < cooldown) return;
    if (score <= 0) return;
    out.push({ kind, score: Math.round(score * 100) / 100, reason });
  };

  // 1. 他上次说了句累/烦/难受：这是最该问一声的
  if (lastInText && gap < 36 * HOUR && gap > 40 * MINUTE && CARE_RE.test(lastInText)) {
    const who = input.category === 'master' ? '主人' : '对方';
    push('care', 0.95, `${who}上次说「${lastInText.slice(0, 24)}」，隔了${gapText(gap)}，想问问现在好点没有`);
  }

  // 2. 她自己心里闷，想找人说说话（心情低）
  if (Number(life.mood) < 42) {
    push('mood', 0.85, `心里有点闷（心情 ${Math.round(Number(life.mood))}），想找他待一会儿`);
  }
  // 3. 累到撑不住，想撒娇
  if (Number(life.energy) < 26 && life.stage === 'awake') {
    push('tired', 0.7, `累得差不多了（精力 ${Math.round(Number(life.energy))}），想撒个娇`);
  }
  // 4. 心情好，想分享
  if (Number(life.mood) > 78) {
    push('share', 0.55, '心情很好，想分给他一点');
  }

  // 5. 空下来了，单纯想他
  if (gap > 4 * HOUR) {
    push('miss', 0.5 + Math.min(0.2, gap / (48 * HOUR)), `隔了${gapText(gap)}没说话，有点想他`);
  }

  // 6. 时间点
  if (life.stage === 'awake') {
    if (hour >= 7 && hour < 9.5 && gap > 2 * HOUR) push('morning', 0.5, '刚醒来，想跟他说声早安');
    if (hour >= 11.3 && hour < 13.5) push('meal', 0.45, '到饭点了，想问问他吃了没');
    if (hour >= 20.5 && hour < 22.5 && gap > 90 * MINUTE) push('evening', 0.5, '晚上闲下来了，想跟他聊聊今天');
    if (hour >= 22.5 || hour < 1) push('night', 0.4, '很晚了，想知道他睡没睡');
  }

  // 7. 她自己的日子：刚看完一集剧，正好有话说
  if (input.showTitle) {
    push('show', 0.5, `刚看完《${input.showTitle}》那一集，正想跟他讲两句`);
  }

  out.sort((a, b) => b.score - a.score);
  return out;
}

/** 唤醒她时说的话：带着理由，而不只是"找他聊点什么" */
export function buildProactivePrompt(opts) {
  const { candidate, now, timeZone, lifeText, lastInText, gap, silenceToken = '[不发]', category } = opts;
  const lines = ['<proactive>'];
  lines.push('现在是 ' + clockText(now, timeZone) + '。');
  if (lastInText) {
    lines.push('他上次说：「' + lastInText.slice(0, 80) + '」（' + gapText(gap) + '前）。');
  } else {
    lines.push('你们还没怎么聊过。');
  }
  if (lifeText) lines.push('你此刻：' + lifeText);
  lines.push('');
  lines.push('你现在想找他，是因为：' + candidate.reason + '。');
  if (category === 'group') {
    lines.push('想接话就自然地说一句；不想说就只回复「' + silenceToken + '」。');
  } else {
    lines.push('想说什么就顺着这个念头写下来，像平时发消息一样；觉得现在不合适、或者其实没那么想说，就只回复「' + silenceToken + '」。');
  }
  lines.push('不要说"主动""系统""提示"这些词，也不要提这行字。');
  lines.push('</proactive>');
  return lines.join('\n');
}
