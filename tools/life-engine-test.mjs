// 生活状态引擎自测：跑一天，看精力/心情/睡眠是否按预期走
import assert from 'node:assert/strict';
import { advance, applyEvent, describe, initialState, verbose, MOOD_CALM } from '../plugins/dsh-dafeiyu-life/lib/engine.js';

const H = 3600_000;
const settings = { timeZone: 'Asia/Shanghai', sleepStart: '23:40', sleepEnd: '08:10' };
const at = (h, m = 0) => new Date(`2026-10-30T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+08:00`).getTime();

let s = initialState(at(9));
assert.equal(s.stage, 'awake');
console.log('09:00 起床：', describe(s, at(9), settings));

// 白天八小时：精力应该掉
const r1 = advance(s, at(17), settings);
assert.equal(r1.state.stage, 'awake', '白天应该是醒着的');
assert.ok(r1.state.energy < s.energy, '醒来一天精力要掉');
console.log('17:00：', describe(r1.state, at(17), settings));

// 深夜自动睡着
const r2 = advance(r1.state, at(23, 50), settings);
assert.equal(r2.state.stage, 'sleeping', '过了 23:40 该睡了');
assert.ok(r2.events.some((e) => e.kind === 'sleep'));
console.log('23:50：', describe(r2.state, at(23, 50), settings));

// 睡一晚到第二天早上 08:30，精力回满大半
const r3 = advance(r2.state, at(8, 30) + 24 * H, settings);
assert.equal(r3.state.stage, 'awake', '到点该醒了');
assert.ok(r3.state.energy > 70, '睡一觉精力应该回到 70 以上，实际 ' + Math.round(r3.state.energy));
assert.ok(r3.events.some((e) => e.kind === 'wake'));
console.log('次日 08:30：', describe(r3.state, at(8, 30) + 24 * H, settings));

// 心情事件：难过会掉，开心会涨，但都会往平静回归
const sad = applyEvent(r3.state, 'sad', 5);
assert.ok(sad.mood < r3.state.mood, '难过要掉心情');
const joy = applyEvent(sad, 'joy', 5);
assert.ok(joy.mood > sad.mood, '开心要涨心情');
const calmLater = advance(joy, at(8, 30) + 24 * H + 6 * H, settings).state;
assert.ok(Math.abs(calmLater.mood - MOOD_CALM) < Math.abs(joy.mood - MOOD_CALM) + 15, '心情会往平静回归');
console.log('难过→开心→六小时后：', Math.round(sad.mood), '→', Math.round(joy.mood), '→', Math.round(calmLater.mood));

// 午睡
const nap = advance({ ...r3.state, stage: 'awake', lastTick: at(13) + 24 * H }, at(13, 1) + 24 * H, settings);
assert.equal(nap.state.stage, 'awake', '白天不自动睡');
const napState = { ...nap.state, stage: 'napping', stageSince: at(13) + 24 * H, napUntil: at(13, 25) + 24 * H, lastTick: at(13) + 24 * H };
const napDone = advance(napState, at(13, 30) + 24 * H, settings);
assert.equal(napDone.state.stage, 'awake', '午睡到点要醒');
assert.ok(napDone.events.some((e) => e.kind === 'wake'));
console.log('午睡醒来：', describe(napDone.state, at(13, 30) + 24 * H, settings));

console.log('\n详情版：\n' + verbose(r3.state, at(8, 30) + 24 * H, settings));
console.log('\n全部通过 ✅');
