// 心情桥：读 dsh-mood 插件维护的心情状态（~/.dsh/dsh-mood.json），让心智层不再自带第二套心情。
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_FILE = () => path.join(process.env.HOME || '/home/example', '.dsh', 'dsh-mood.json');

/** 心情 id → 中文（与 dsh-mood 的 33 种对应） */
export const MOOD_LABEL = {
  calm: '平静', happy: '开心', curious: '好奇', focused: '专注', excited: '兴奋',
  tired: '疲惫', annoyed: '烦躁', down: '低落', sulk: '生闷气', hurt: '委屈',
  proud: '得意', gloomy: '消沉', anxious: '焦虑', numb: '麻木', lonely: '孤单',
  flutter: '心动', love: '恋慕', jealous: '吃醋', burnout: '内耗', cracked: '破防',
  checkedout: '摆烂', hyper: '上头', fear: '恐惧', disgust: '厌恶', surprise: '惊讶',
  shame: '羞耻', guilt: '内疚', awkward: '尴尬', sympathy: '同情', disappointed: '失望',
  nostalgia: '怀旧', coy: '撒娇', conflict: '矛盾',
};

/** 每种心情对「想不想主动找人说话」的大致折算（0~100） */
const MOOD_SCORE = {
  happy: 78, excited: 76, hyper: 74, proud: 72, curious: 68, flutter: 70, love: 72,
  coy: 70, calm: 55, focused: 52, sympathy: 50, nostalgic: 50, surprise: 58,
  tired: 34, burnout: 28, annoyed: 32, down: 26, gloomy: 22, sad: 22, lonely: 20,
  hurt: 24, anxious: 30, awkward: 38, disappointed: 30, jealous: 34, conflict: 32,
  numb: 30, checkedout: 26, cracked: 18, shame: 28, guilt: 30, fear: 24, disgust: 30,
};

/** 读 dsh-mood 的状态文件；没有就返回 null（退回引擎自带的心情） */
export function readExternalMood(file = DEFAULT_FILE()) {
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!raw || typeof raw !== 'object' || !raw.current) return null;
    const values = raw.values && typeof raw.values === 'object' ? raw.values : {};
    const sorted = Object.entries(values)
      .filter(([, v]) => Number.isFinite(Number(v)))
      .sort((a, b) => Number(b[1]) - Number(a[1]));
    const top = raw.current;
    const second = sorted.find(([k]) => k !== top && Number(k === top ? 0 : 1) >= 0)?.[0] ?? null;
    const topValue = Number(values[top] ?? 0);
    const secondValue = second ? Number(values[second] ?? 0) : 0;
    // 分差小才算「掺着」
    const blend = second && Math.abs(topValue - secondValue) <= 2.5 ? second : null;
    return {
      current: top,
      label: MOOD_LABEL[top] || top,
      blend,
      blendLabel: blend ? MOOD_LABEL[blend] || blend : null,
      score: MOOD_SCORE[top] ?? 55,
      values,
    };
  } catch {
    return null;
  }
}

/** 注入用的一句话：现在的心情（掺着 X） */
export function moodText(mood) {
  if (!mood) return '';
  return mood.blendLabel ? `心情${mood.label}，掺着一点${mood.blendLabel}` : `心情${mood.label}`;
}
