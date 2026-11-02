// 把旧 life.db 的日子、剧集、状态、最近聊天记录搬进心智层 mind.db。
// 只在首次合并时跑一次；已经存在的行不覆盖。
import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const root = process.argv[2] ?? '/home/example/dafeiyu-linux/大肥鱼小窝'
const oldFile = path.join(root, '04工作区', '生活', 'life.db')
const newFile = path.join(root, '04工作区', '心智', 'mind.db')

if (!fs.existsSync(oldFile)) {
  console.log('没有旧的 life.db，跳过：' + oldFile)
  process.exit(0)
}
if (!fs.existsSync(newFile)) {
  console.log('mind.db 还没生成，先把插件跑起来再来：' + newFile)
  process.exit(1)
}

const old = new DatabaseSync(oldFile, { readOnly: true })
const db = new DatabaseSync(newFile)
db.exec('PRAGMA journal_mode = WAL')

const has = (table, key, value) => db.prepare(`SELECT 1 FROM ${table} WHERE ${key} = ?`).get(value) !== undefined

let days = 0
for (const row of old.prepare('SELECT day, agenda, series, dream, updated FROM days').all()) {
  if (has('days', 'day', row.day)) continue
  db.prepare('INSERT INTO days (day, agenda, series, dream, diary, updated) VALUES (?, ?, ?, ?, NULL, ?)').run(
    row.day,
    row.agenda ?? '{"day":"' + row.day + '","items":[]}',
    row.series ?? 'null',
    row.dream ?? '',
    row.updated ?? Date.now(),
  )
  days++
}

let events = 0
for (const row of old.prepare('SELECT ts, kind, note FROM events').all()) {
  const dup = db.prepare('SELECT 1 FROM events WHERE ts = ? AND kind = ?').get(row.ts, row.kind)
  if (dup) continue
  db.prepare('INSERT INTO events (ts, kind, intensity, note) VALUES (?, ?, ?, ?)').run(row.ts, row.kind, 3, row.note ?? '')
  events++
}

let umos = 0
for (const row of old.prepare('SELECT * FROM umos').all()) {
  if (has('umos', 'umo', row.umo)) continue
  db.prepare(
    'INSERT INTO umos (umo, category, last_in, last_in_text, last_out, last_fire, last_kind, last_kind_at, day, fires) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(row.umo, row.category ?? 'private', row.last_in ?? 0, row.last_in_text ?? '', row.last_out ?? 0, row.last_fire ?? 0, row.last_kind ?? '', row.last_kind_at ?? 0, row.day ?? '', row.fires ?? 0)
  umos++
}

// 状态：只有在 mind.db 还没跑过一天、且旧库有状态时才接过来
const oldState = old.prepare("SELECT value AS v FROM meta WHERE key = 'state'").get()
const newBooted = db.prepare("SELECT v FROM meta WHERE k = 'bootedAt'").get()
if (oldState?.v && !newBooted) {
  db.prepare("INSERT INTO meta (k, v) VALUES ('state', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").run(oldState.v)
}

console.log(`搬完：日程 ${days} 天、事件 ${events} 条、聊天记录 ${umos} 条`)
console.log('提示：日程里如果已经有今天的行，就保留 mind.db 自己的，不覆盖。')
