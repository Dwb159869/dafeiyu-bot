// 主动消息候选逻辑自测（纯函数，不起宿主）
import assert from 'node:assert/strict';
import { blockedBy, buildCandidates, buildProactivePrompt, inQuiet } from '../plugins/dsh-dafeiyu-life/lib/proactive.js';

const H = 3_600_000;
const base = new Date('2026-10-30T20:30:00+08:00').getTime();
const s = {
  timeZone: 'Asia/Shanghai',
  quietStart: '01:00',
  quietEnd: '09:00',
  minGapMinutes: 90,
  recentMinutes: 40,
  capPerDay: 6,
  kindCooldownHours: 6,
  privateEnabled: false,
  groupEnabled: false,
};

const mk = (over = {}) => ({
  now: base,
  timeZone: s.timeZone,
  category: 'master',
  lastIn: base - 3 * H,
  lastInText: '今天加班累死了',
  lastOut: base - 5 * H,
  lastFire: base - 10 * H,
  firesToday: 0,
  lastKind: '',
  lastKindAt: 0,
  life: { energy: 60, mood: 60, stage: 'awake' },
  ...over,
});

// 1. 他说累过 → care 排第一
let c = buildCandidates(mk(), s);
assert.equal(c[0].kind, 'care', '应该有 care 且排第一');
assert.ok(c[0].reason.includes('累'));
console.log('care:', c[0].reason);

// 2. 免打扰
assert.ok(inQuiet(new Date('2026-10-30T02:00:00+08:00').getTime(), '01:00', '09:00', s.timeZone));
assert.equal(blockedBy(mk({ now: new Date('2026-10-30T02:00:00+08:00').getTime() }), s), '免打扰时间');

// 3. 她刚说过话
assert.equal(blockedBy(mk({ lastOut: base - 10 * 60_000 }), s), '她刚说过话');

// 4. 今天主动次数够了
assert.equal(blockedBy(mk({ firesToday: 6 }), s), '今天主动次数够了');

// 5. 同类理由冷却
c = buildCandidates(mk({ lastKind: 'care', lastKindAt: base - H }), s);
assert.ok(!c.some((x) => x.kind === 'care'), '一小时内用过 care 不该再出现');
console.log('冷却后候选:', c.map((x) => x.kind).join(','));

// 6. 心情低 / 累 / 心情好
c = buildCandidates(mk({ lastInText: '', life: { energy: 60, mood: 30, stage: 'awake' } }), s);
assert.ok(c.some((x) => x.kind === 'mood'));
c = buildCandidates(mk({ lastInText: '', life: { energy: 15, mood: 60, stage: 'awake' } }), s);
assert.ok(c.some((x) => x.kind === 'tired'));
c = buildCandidates(mk({ lastInText: '', life: { energy: 60, mood: 85, stage: 'awake' } }), s);
assert.ok(c.some((x) => x.kind === 'share'));

// 7. 很久没说话 → miss 分数随时间涨
const miss1 = buildCandidates(mk({ lastInText: '', life: { energy: 60, mood: 60, stage: 'awake' }, lastIn: base - 5 * H }), s).find((x) => x.kind === 'miss');
const miss2 = buildCandidates(mk({ lastInText: '', life: { energy: 60, mood: 60, stage: 'awake' }, lastIn: base - 40 * H }), s).find((x) => x.kind === 'miss');
assert.ok(miss2.score > miss1.score, '隔得越久越想他');

// 8. 睡着的时候不该有候选（由调用方挡，这里只验证时间点类不出现）
c = buildCandidates(mk({ lastInText: '', life: { energy: 60, mood: 60, stage: 'sleeping' } }), s);
assert.ok(!c.some((x) => ['morning', 'meal', 'evening', 'night'].includes(x.kind)), '睡着时不该有到点问候');

// 9. 唤醒提示词带理由
const prompt = buildProactivePrompt({
  candidate: c[0] ?? { kind: 'miss', score: 0.5, reason: '有点想他' },
  now: base,
  timeZone: s.timeZone,
  lifeText: '精力有点累，心情平静',
  lastInText: '今天加班累死了',
  gap: 3 * H,
  silenceToken: '[不发]',
  category: 'master',
});
assert.ok(prompt.includes('因为：'));
assert.ok(prompt.includes('[不发]'));
console.log('\n--- 提示词样例 ---\n' + prompt);

console.log('\n全部通过 ✅');
