// 日程、节目单、梦：给她一段自己的白天，而不是只有"在等主人说话"。
//
// 为什么要这个：
//   现在的她只有"此刻的身体状态"（精力/心情/睡没睡），没有"今天本来打算干什么"。
//   于是每次开口都只能围绕着主人，说来说去都是那几句。
//   这里给她排一份当天的安排——起床、晒太阳、买菜、追剧的第几集、几点洗澡——
//   再把"这个点她大概在做什么"告诉模型，她才有自己的话头可以说（"刚看完那集"、"今天买到了草莓"）。
//
// 本文件只做纯计算，落库和注入在 index.js。

const MINUTE = 60_000;
const DAY = 86_400_000;

// 虚构的剧：只用来当"她在追的东西"，不指向任何真实作品
export const SERIES_POOL = [
  { title: '雪夜列车', eps: 24, perDay: 2, tag: '悬疑' },
  { title: '海边的旧书店', eps: 12, perDay: 1, tag: '慢节奏' },
  { title: '小镇诊所', eps: 40, perDay: 2, tag: '日常' },
  { title: '午夜电台', eps: 16, perDay: 1, tag: '治愈' },
  { title: '巷口的猫', eps: 20, perDay: 1, tag: '轻松' },
];

const WEEKDAY_DAY = [
  ['08:10', '起床，拉开窗帘，先发一会儿呆', 'wake'],
  ['08:45', '早饭：热了牛奶，煎了个蛋', 'meal'],
  ['09:30', '收拾屋子，把昨天的衣服叠好', 'chore'],
  ['10:30', '在窗边坐着，晒晒太阳', 'rest'],
  ['12:00', '午饭：简单弄了两个菜', 'meal'],
  ['13:00', '午睡一会儿', 'nap'],
  ['14:10', '下午：整理相册', 'focus'],
  ['16:30', '出门走走，顺便买点菜', 'errand'],
  ['18:30', '晚饭：边吃边刷手机', 'meal'],
  ['19:30', '洗碗，然后洗澡', 'chore'],
  ['20:10', '追剧', 'show'],
  ['21:40', '躺一会儿，刷手机', 'rest'],
  ['23:40', '睡觉', 'sleep'],
];

const WEEKEND_DAY = [
  ['09:40', '睡到自然醒，赖了一会儿床', 'wake'],
  ['10:20', '早饭：面包和咖啡', 'meal'],
  ['11:00', '大扫除，洗衣服', 'chore'],
  ['12:30', '午饭：点了外卖', 'meal'],
  ['13:30', '补番，一口气看了好几集', 'show'],
  ['15:30', '出门逛了逛，去了公园', 'errand'],
  ['18:00', '晚饭，吃得比平时晚', 'meal'],
  ['19:30', '洗澡，换上舒服的衣服', 'chore'],
  ['20:10', '追剧', 'show'],
  ['22:00', '听歌，整理相册', 'rest'],
  ['23:50', '睡觉', 'sleep'],
];

// 小档案（大肥鱼小窝/02资料库/文档/2026-10/大肥鱼小档案_v2）里定下的口味与爱好：
// 饭从爱吃里挑，忌口（香菜、苦瓜、太辣）永远不出现；空闲从爱好里挑。
export const MEAL_POOLS = {
  breakfast: ['米饭配小菜', '热牛奶和面包', '煎蛋配米饭', '昨天的剩饭炒一炒'],
  lunch: ['米饭配家常菜', '一碗面，加个蛋', '剩菜热一热，配米饭'],
  dinner: ['米饭配两个菜', '简单煮碗汤面', '点了外卖，实在不想动'],
};
export const HOBBIES = ['刷剧', '上网刷帖子', '打游戏', '拼图', '整理相册', '给窗台上的花浇水', '听歌发呆'];
export const AFTERNOON_POOL = HOBBIES;
const ERRAND_POOL = ['去楼下买菜', '去便利店买点东西', '去公园走一圈', '去拿快递'];
const SPECIAL_POOL = [
  ['收到快递，是一年前自己买的票根', 'special'],
  ['楼下那只猫又来蹭饭了', 'special'],
  ['试着做了道没做过的菜，居然还行', 'special'],
  ['翻到以前的照片，看了很久', 'special'],
];

/** 本地日期 YYYY-MM-DD */
export function localDay(nowMs, timeZone) {
  try {
    return new Intl.DateTimeFormat('sv-SE', {
      timeZone: timeZone || undefined,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(nowMs));
  } catch {
    return new Date(nowMs).toISOString().slice(0, 10);
  }
}

/** 星期几（0=周日） */
export function weekdayOf(day) {
  const d = new Date(day + 'T12:00:00');
  return Number.isNaN(d.getTime()) ? new Date().getDay() : d.getDay();
}

const pick = (arr, rng) => arr[Math.floor(rng() * arr.length) % arr.length];
const toMinLocal = (t) => {
  const [h, m] = String(t).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/**
 * 排一天的安排。同一天多次调用要给同一个 day，最好带着 series 状态，不然剧集会一直停在第 1 集。
 * @param {string} day  YYYY-MM-DD
 * @param {{series?:{title:string,ep:number,eps:number,perDay:number}, energy?:number, mood?:number, seed?:number}} opts
 * @returns {{day:string, items:Array<{t:string,what:string,kind:string,done?:boolean}>, series:any}}
 */
export function buildAgenda(day, opts = {}) {
  let seed = Number(opts.seed ?? 0) || [...day].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 1_000_003, 7);
  const rng = () => {
    seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
    return seed / 2_147_483_648;
  };
  const wd = weekdayOf(day);
  const weekend = wd === 0 || wd === 6;
  const template = (weekend ? WEEKEND_DAY : WEEKDAY_DAY).map(([t, what, kind]) => ({ t, what, kind }));

  const series = opts.series && opts.series.title
    ? { ...opts.series }
    : { ...pick(SERIES_POOL, rng) };
  series.eps = Number(series.eps ?? 24);
  series.perDay = Number(series.perDay ?? 1);
  series.ep = Math.max(1, Math.min(series.eps, Number(series.ep ?? 1)));

  const items = [];
  for (const it of template) {
    if (it.kind === 'show') {
      // 一天看 perDay 集（周末多一集），每插入一集推进 ep
      const count = weekend ? series.perDay + 1 : series.perDay;
      for (let i = 0; i < count; i++) {
        const [h, m] = it.t.split(':').map(Number);
        const start = h * 60 + m + i * 45;
        const t = `${String(Math.floor(start / 60)).padStart(2, '0')}:${String(start % 60).padStart(2, '0')}`;
        items.push({ t, what: `追《${series.title}》第 ${series.ep} 集`, kind: 'show', ep: series.ep });
        series.ep = series.ep >= series.eps ? 1 : series.ep + 1;
      }
      continue;
    }
    if (it.kind === 'meal') {
      // 早饭/午饭/晚饭按时间取料，从她爱吃的里挑
      const m = toMinLocal(it.t);
      const pool = m < 11 * 60 ? MEAL_POOLS.breakfast : m < 15 * 60 ? MEAL_POOLS.lunch : MEAL_POOLS.dinner;
      const label = m < 11 * 60 ? '早饭' : m < 15 * 60 ? '午饭' : '晚饭';
      items.push({ ...it, what: label + '：' + pick(pool, rng) });
      continue;
    }
    if (it.kind === 'focus') {
      items.push({ ...it, what: '下午：' + pick(AFTERNOON_POOL, rng) });
      continue;
    }
    if (it.kind === 'errand' && rng() < 0.7) {
      items.push({ ...it, what: '出门：' + pick(ERRAND_POOL, rng) });
      continue;
    }
    items.push({ ...it });
  }

  // 工作日的晚上，除了追剧也常有点别的乐子
  if (!weekend && rng() < 0.5) {
    items.push({ t: '22:20', what: pick(['打两把游戏', '上网刷会儿帖子', '窝着刷剧', '听歌发呆'], rng), kind: 'hobby' });
  }
  if (rng() < 0.35) {
    const [what, kind] = pick(SPECIAL_POOL, rng);
    const at = weekend ? '15:50' : '17:20';
    items.push({ t: at, what, kind });
  }

  items.sort((a, b) => a.t.localeCompare(b.t));
  return { day, items: items.map((x) => ({ ...x, done: false })), series: { title: series.title, ep: series.ep, eps: series.eps, perDay: series.perDay } };
}

const toMin = (t) => {
  const [h, m] = String(t).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** 现在这个点在做什么（返回当前项和下一项） */
export function currentItem(agenda, nowMs, timeZone, localMinutes) {
  const items = Array.isArray(agenda?.items) ? agenda.items : [];
  if (items.length === 0) return { now: null, next: null };
  const min = typeof localMinutes === 'function' ? localMinutes(nowMs, timeZone) : new Date(nowMs).getHours() * 60 + new Date(nowMs).getMinutes();
  let cur = null;
  let next = null;
  for (const it of items) {
    if (toMin(it.t) <= min) cur = it;
    else {
      next = it;
      break;
    }
  }
  return { now: cur, next };
}

const WD = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/**
 * 注入用的安排：不报整张表，只说她此刻和接下来两步，带一点"今天已经做过什么"。
 * 只有在陪伴预设里才用得到。
 */
export function agendaContext(agenda, nowMs, timeZone, localMinutes) {
  if (!agenda || !Array.isArray(agenda.items) || agenda.items.length === 0) return '';
  const { now, next } = currentItem(agenda, nowMs, timeZone, localMinutes);
  const wd = WD[weekdayOf(agenda.day)];
  const done = agenda.items.filter((x) => x.done);
  const lines = [`【你今天自己的安排（${wd}）】`];
  if (now) lines.push(`这个点：${now.t} ${now.what}${now.done ? '（已经做完）' : ''}`);
  if (next) lines.push(`接下来：${next.t} ${next.what}`);
  if (done.length > 0) lines.push(`今天已经：${done.slice(-3).map((x) => x.what).join('；')}`);
  const showLater = agenda.items.find((x) => x.kind === 'show' && !x.done && (now === null || toMin(x.t) > toMin(now.t)));
  if (showLater) lines.push(`还没看的：${showLater.t} ${showLater.what}`);
  lines.push('（这些是你自己的日子，不是任务清单：他不问就不用一件件汇报，聊到了自然带上就行。）');
  return lines.join('\n');
}

/** 节目单：她最近在追的剧和集数进度 */
export function seriesLine(series) {
  if (!series || !series.title) return '';
  return `你最近在追《${series.title}》，一共 ${series.eps} 集，已经看到第 ${Math.max(1, series.ep - 1)} 集。`;
}

// ---------------- 梦 ----------------

const DREAM_SCENES = [
  '下着雨的窗边',
  '一列一直开到不了站的火车上',
  '旧书店的二楼',
  '一条没有路灯的街',
  '退了潮的海边',
  '雪夜的站台',
  '一间很亮但没有人说话的屋子',
  '厨房里，锅还在咕嘟',
];

const DREAM_ACTS = [
  '一直在找什么东西，却想不起来是什么',
  '把伞递过来，可我怎么也接不住',
  '坐在对面笑，说了句我听不清的话',
  '把一本书推到我面前，翻开是空的',
  '牵着我的手往前走，走得很快',
  '忽然回头问："你冷不冷？"',
];

const DREAM_TWISTS = [
  '醒来的时候枕头有点湿',
  '醒来发现手心里攥着被角',
  '醒了以后发了会儿呆，才想起来是个梦',
  '梦里的我想说"别走"，但是没有出声',
  '醒来天已经亮了，心里还留着一点空',
  '醒来以后特别想给他发消息，又觉得太早',
];

/** 昨天聊到的词：挑一两个当梦里的线索 */
function motifsOf(text) {
  const t = String(text ?? '');
  const found = [];
  const rules = [
    [/加班|班|工作|忙/, '办公室的灯一直亮着'],
    [/累|困|睡|熬/, '怎么走都走不到床前'],
    [/花|送/, '开满花的阳台'],
    [/猫|狗|宠物/, '一只猫蹲在窗台上'],
    [/吃|饭|菜|面/, '一桌还热着的菜'],
    [/雨|雪|天气/, '雨一直没停'],
    [/游戏|打/, '一条长得没有尽头的走廊'],
  ];
  for (const [re, scene] of rules) if (re.test(t)) found.push(scene);
  return found;
}

/**
 * 编一个昨晚的梦。不是随机拼凑：优先用昨天聊到的线索，其次用她在追的剧，
 * 这样"梦"和她这两天的生活是有关系的，第二天提起时不会前后矛盾。
 */
export function composeDream(opts = {}) {
  const seed = Number(opts.seed ?? 0) || Date.now() % 1_000_003;
  let s = seed;
  const rng = () => {
    s = (s * 1_103_515_245 + 12_345) % 2_147_483_648;
    return s / 2_147_483_648;
  };
  const hints = motifsOf(opts.lastChat);
  const scene = hints.length > 0 ? hints[Math.floor(rng() * hints.length)] : pick(DREAM_SCENES, rng);
  const who = opts.series?.title ? `《${opts.series.title}》里的一个人` : '一个看不清脸的人';
  const act = pick(DREAM_ACTS, rng);
  const twist = pick(DREAM_TWISTS, rng);
  const second = rng() < 0.5 ? `梦里还有${who}，${act}。` : `后来梦见${who}，${act}。`;
  return `梦见${scene}。${second}${twist}。`;
}

export function dreamContext(agenda, nowMs, timeZone, localMinutes) {
  if (!agenda?.dream) return '';
  const min = typeof localMinutes === 'function' ? localMinutes(nowMs, timeZone) : new Date(nowMs).getHours() * 60;
  // 只有早上到中午才提"昨晚的梦"，晚上再提就奇怪了
  if (min < 6 * 60 || min > 12 * 60) return '';
  return `【昨晚的梦】${agenda.dream}\n（醒来还记得，还没跟他说过。可以自己决定要不要说。）`;
}

export const DAY_MS = DAY;
export const MINUTE_MS = MINUTE;
