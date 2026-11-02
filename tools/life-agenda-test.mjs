// 日程 / 节目单 / 梦 的纯函数自测
// 跑法：node tools/life-agenda-test.mjs
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import {
  SERIES_POOL,
  agendaContext,
  buildAgenda,
  composeDream,
  currentItem,
  dreamContext,
  localDay,
  seriesLine,
  weekdayOf,
} from '../plugins/dsh-dafeiyu-life/lib/agenda.js';
import { LifeStore } from '../plugins/dsh-dafeiyu-life/lib/store.js';
import { localMinutes } from '../plugins/dsh-dafeiyu-life/lib/engine.js';

const TZ = 'Asia/Shanghai';
const at = (day, hh, mm) => new Date(`${day}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00+08:00`).getTime();
let pass = 0;
const ok = (name, fn) => {
  fn();
  pass++;
  console.log('  ✓ ' + name);
};

console.log('日程');
ok('工作日排得出一整天，时间有序、有剧', () => {
  // 2026-10-28 是周三
  const a = buildAgenda('2026-10-28', {});
  assert.ok(a.items.length >= 10, '项目太少：' + a.items.length);
  const times = a.items.map((x) => x.t);
  assert.deepEqual(times, [...times].sort(), '时间没有排序');
  const shows = a.items.filter((x) => x.kind === 'show');
  assert.ok(shows.length >= 1, '没有追剧');
  assert.ok(shows.every((x) => /第 \d+ 集/.test(x.what)), '剧集没有集数');
  assert.ok(a.items.some((x) => x.kind === 'meal'), '没有吃饭');
  assert.ok(a.items.some((x) => x.kind === 'sleep'), '没有睡觉');
});

ok('同一天重排是稳定的（不会每次都不一样）', () => {
  const a = buildAgenda('2026-10-28', {});
  const b = buildAgenda('2026-10-28', {});
  assert.deepEqual(a.items.map((x) => x.what), b.items.map((x) => x.what));
});

ok('周末和平时不一样（多睡会儿、多一集）', () => {
  const wd = buildAgenda('2026-10-28', {});
  const we = buildAgenda('2026-10-31', {}); // 周六
  const wdShows = wd.items.filter((x) => x.kind === 'show').length;
  const weShows = we.items.filter((x) => x.kind === 'show').length;
  assert.ok(weShows > wdShows, `周末剧集没有更多：${weShows} vs ${wdShows}`);
  assert.ok(we.items[0].what.includes('自然醒'), '周末第一项应当是睡懒觉');
});

ok('剧集进度能跨天接上', () => {
  const d1 = buildAgenda('2026-10-28', { series: { ...SERIES_POOL[0], ep: 5, eps: 24, perDay: 2 } });
  const d2 = buildAgenda('2026-10-29', { series: d1.series });
  assert.ok(d2.series.title === d1.series.title, '换剧了');
  const epOf = (a) => Number(/第 (\d+) 集/.exec(a.items.find((x) => x.kind === 'show').what)[1]);
  assert.ok(epOf(d2) >= epOf(d1), '集数倒退了');
  assert.ok(d2.series.ep > d1.series.ep || epOf(d2) === 1, '集数没有推进');
});

ok('放到最后一集会从头开始，不会越界', () => {
  const a = buildAgenda('2026-10-28', { series: { ...SERIES_POOL[1], ep: 12, eps: 12, perDay: 1 } });
  assert.ok(a.series.ep >= 1 && a.series.ep <= 12);
});

ok('currentItem 能认出这个点在做什么、下一步做什么', () => {
  const a = buildAgenda('2026-10-28', {});
  const night = at('2026-10-28', 20, 30);
  const { now, next } = currentItem(a, night, TZ, localMinutes);
  assert.ok(now, '没有当前项');
  assert.ok(now.t <= '20:30', `当前项时间不对：${now.t}`);
  assert.ok(next === null || next.t > now.t, '下一项时间不对');
  const early = currentItem(a, at('2026-10-28', 6, 0), TZ, localMinutes);
  assert.equal(early.now, null, '六点不该已经有安排');
});

ok('注入文案只说这个点和接下来，不报整张表', () => {
  const a = buildAgenda('2026-10-28', {});
  a.items[1].done = true;
  const text = agendaContext(a, at('2026-10-28', 14, 20), TZ, localMinutes);
  assert.ok(text.includes('这个点'), '没有"这个点"');
  assert.ok(text.includes('接下来'), '没有"接下来"');
  assert.ok(text.includes('周'), '没有星期');
  assert.ok(text.length < 600, '注入太长了：' + text.length);
  assert.ok(text.includes('自己的日子'), '没有定调');
});

ok('节目单进度是给人看的一句话', () => {
  const line = seriesLine({ title: '雪夜列车', eps: 24, ep: 7, perDay: 2 });
  assert.ok(line.includes('雪夜列车') && line.includes('24') && line.includes('6'), line);
});

console.log('梦');
ok('梦里会用上昨天聊到的线索', () => {
  const d = composeDream({ lastChat: '今天加班到现在，累死了', seed: 42 });
  assert.ok(d.endsWith('。'), '梦没有结尾');
  assert.ok(d.length > 10, '梦太短');
  assert.ok(/办公室的灯一直亮着|床前/.test(d), '没有用上"加班/累"的线索：' + d);
});

ok('没有线索时也能编一个像样的梦', () => {
  const d = composeDream({ lastChat: '', seed: 7 });
  assert.ok(d.startsWith('梦见'), d);
  assert.ok(d.length > 15, d);
});

ok('同一个种子编出来的梦是一样的（不会每次刷新都变）', () => {
  assert.equal(composeDream({ lastChat: '下雨了', seed: 9 }), composeDream({ lastChat: '下雨了', seed: 9 }));
});

ok('梦只在早上到中午提，晚上不提', () => {
  const agenda = { agenda: { day: '2026-10-28', items: [] }, dream: '梦见一条一直开不到站的火车。' };
  const morning = dreamContext(agenda, at('2026-10-28', 8, 30), TZ, localMinutes);
  assert.ok(morning.includes('火车'), '早上没提梦');
  const night = dreamContext(agenda, at('2026-10-28', 21, 0), TZ, localMinutes);
  assert.equal(night, '');
});

console.log('落库');
ok('日程、剧集、梦都能存下来再读出来', () => {
  const dir = path.join(os.tmpdir(), 'life-agenda-test-' + Date.now());
  const store = new LifeStore(path.join(dir, 'life.db'));
  store.saveDay('2026-10-28', {
    agenda: { day: '2026-10-28', items: [{ t: '08:10', what: '起床', kind: 'wake', done: false }] },
    series: { title: '午夜电台', ep: 3, eps: 16, perDay: 1 },
    dream: '梦见旧书店的二楼。',
  });
  const row = store.day('2026-10-28');
  assert.equal(row.agenda.items.length, 1);
  assert.equal(row.series.title, '午夜电台');
  assert.equal(row.dream, '梦见旧书店的二楼。');
  store.saveDay('2026-10-28', { dream: '改过的梦。' });
  assert.equal(store.day('2026-10-28').dream, '改过的梦。');
  assert.equal(store.day('2026-10-28').agenda.items.length, 1, '改梦不该把日程冲掉');
  assert.equal(store.recentDays(5)[0].day, '2026-10-28');
  store.close();
});

ok('本地日期按北京时间算', () => {
  // 2026-10-28 23:30 UTC 已经是北京时间 10-29 07:30
  assert.equal(localDay(Date.UTC(2026, 9, 28, 23, 30), TZ), '2026-10-29');
  assert.equal(weekdayOf('2026-10-31'), 6);
});

console.log(`\n全部通过：${pass} 项`);
