#!/usr/bin/env node
// 把 nekowhale-stickers 的 322 张表情下载进 vault 表情库，并生成分类映射
import { createWriteStream } from 'node:fs';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const SRC = '/home/example/.dsh/profiles/web/plugins/dsh-nekowhale-stickers/meta/nekowhale.json';
const OUT = '/home/example/dafeiyu-linux/大肥鱼小窝/02资料库/表情包/nekowhale-大肥鱼';
const UA = 'nekowhale-stickers (+https://kiriyuki.com)';

// 25 种情绪 → 我们 18 类
const MAP = {
  开心: '开心', 大笑: '开心', 喜欢: '贴贴', 害羞: '害羞', 得意: '开心', 兴奋: '开心',
  惊讶: '惊讶', 疑惑: '疑惑', 思考: '疑惑', 无语: '委屈', 难过: '委屈', 哭: '委屈',
  生气: '生气', 害怕: '委屈', 疲惫: '困倦', 赞同: '应答', 拒绝: '应答',
  打招呼: '招呼', 感谢: '应答', 道歉: '应答', 卖萌: '撒娇', 搞怪: '整活',
  嘲讽: '整活', 安慰: '贴贴', 其他: '待归类',
};

const meta = JSON.parse(await readFile(SRC, 'utf8'));
await mkdir(OUT, { recursive: true });

const rows = [];
let done = 0, failed = 0;
const queue = [...meta.stickers];
const WORKERS = 8;

async function worker() {
  while (queue.length) {
    const s = queue.shift();
    const [pack, stem] = s.id.split('/');
    const file = `${s.id.replace('/', '__')}.gif`;
    const dest = join(OUT, file);
    const url = `https://kiriyuki.com/media/gif/${encodeURIComponent(pack)}/${encodeURIComponent(stem)}.gif?h=${s.hash}`;
    try {
      const r = await fetch(url, { headers: { 'user-agent': UA } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const buf = Buffer.from(await r.arrayBuffer());
      await writeFile(dest, buf);
      done++;
      rows.push({
        rel: `nekowhale-大肥鱼/${file}`,
        cat: MAP[s.emotion] || '待归类',
        note: s.desc || s.use || s.emotion,
        tags: [...new Set([s.emotion, ...(s.tags || []), s.text].filter(Boolean))].slice(0, 8),
        emotion: s.emotion,
        use: s.use || '',
        pack: 'nekowhale-大肥鱼',
        pack_name: '大肥鱼表情包（nekowhale，CC-BY-NC-4.0）',
        source: 'nekowhale',
      });
    } catch (e) {
      failed++;
      console.error('失败', s.id, e.message);
    }
    if ((done + failed) % 40 === 0) console.log(`进度 ${done + failed}/${meta.stickers.length}`);
  }
}
await Promise.all(Array.from({ length: WORKERS }, worker));
await writeFile(join(OUT, 'meta.json'), JSON.stringify({ source: 'dsh-nekowhale-stickers 1.1.1', license: 'CC-BY-NC-4.0 (assets)', author: 'B站 可以叫我云大人 / kiriyuki.com', count: rows.length, items: rows }, null, 1));
console.log(`完成：成功 ${done}，失败 ${failed}`);
