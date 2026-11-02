// 心智层的唯一数据库：mind.db
// 一个库、一条时间线：身体 / 日子 / 读过的东西 / 手账 / 自我认识 / 发言记录 / 预算
import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);
CREATE TABLE IF NOT EXISTS events (ts INTEGER, kind TEXT, intensity INTEGER, note TEXT);
CREATE TABLE IF NOT EXISTS days (day TEXT PRIMARY KEY, agenda TEXT, series TEXT, dream TEXT, diary TEXT, updated INTEGER);
CREATE TABLE IF NOT EXISTS readings (
  id TEXT PRIMARY KEY, bvid TEXT, title TEXT, author TEXT, summary TEXT,
  subtitle_ok INTEGER, frames INTEGER, tokens INTEGER, created INTEGER
);
CREATE TABLE IF NOT EXISTS journals (
  id TEXT PRIMARY KEY, reading_id TEXT, day TEXT, content TEXT,
  facts TEXT, views TEXT, speculation TEXT, created INTEGER
);
CREATE TABLE IF NOT EXISTS self (
  id INTEGER PRIMARY KEY AUTOINCREMENT, sentence TEXT, source TEXT,
  rev INTEGER DEFAULT 1, status TEXT DEFAULT 'active', created INTEGER
);
CREATE TABLE IF NOT EXISTS speak (
  id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, umo TEXT, kind TEXT,
  score REAL, fired INTEGER, note TEXT
);
CREATE TABLE IF NOT EXISTS loops (
  id INTEGER PRIMARY KEY AUTOINCREMENT, umo TEXT, text TEXT, kind TEXT DEFAULT 'follow',
  due INTEGER, status TEXT DEFAULT 'open', created INTEGER, closed INTEGER, note TEXT
);
CREATE TABLE IF NOT EXISTS breathe (
  ts INTEGER, session TEXT, tool TEXT, args TEXT, count INTEGER, warned INTEGER
);
CREATE TABLE IF NOT EXISTS usage (day TEXT PRIMARY KEY, requests INTEGER DEFAULT 0, reads INTEGER DEFAULT 0, tokens INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS umos (
  umo TEXT PRIMARY KEY, category TEXT, last_in INTEGER, last_in_text TEXT,
  last_out INTEGER, last_fire INTEGER, last_kind TEXT, last_kind_at INTEGER,
  day TEXT, fires INTEGER DEFAULT 0
);
`

export function safeParse(v, fallback = null) {
  if (v === null || v === undefined || v === '') return fallback
  try {
    return JSON.parse(v)
  } catch {
    return fallback
  }
}

export class MindDB {
  constructor(file) {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    this.db = new DatabaseSync(file)
    this.db.exec('PRAGMA journal_mode = WAL;')
    this.db.exec(SCHEMA)
  }

  close() {
    try {
      this.db.close()
    } catch {}
  }

  // ---- meta ----
  getMeta(k, fallback = null) {
    const row = this.db.prepare('SELECT v FROM meta WHERE k = ?').get(k)
    return row ? safeParse(row.v, fallback) : fallback
  }

  setMeta(k, v) {
    this.db
      .prepare('INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v')
      .run(k, JSON.stringify(v))
  }

  // ---- events ----
  addEvent(ts, kind, intensity, note = '') {
    this.db.prepare('INSERT INTO events (ts, kind, intensity, note) VALUES (?, ?, ?, ?)').run(ts, kind, intensity, note)
  }

  recentEvents(limit = 5) {
    return this.db.prepare('SELECT ts, kind, intensity, note FROM events ORDER BY ts DESC LIMIT ?').all(limit)
  }

  // ---- days ----
  day(day) {
    const r = this.db.prepare('SELECT * FROM days WHERE day = ?').get(day)
    if (!r) return null
    return {
      day: r.day,
      agenda: safeParse(r.agenda, []),
      series: safeParse(r.series, null),
      dream: r.dream || '',
      diary: safeParse(r.diary, null),
      updated: r.updated,
    }
  }

  saveDay(day, patch) {
    const cur = this.day(day) || { day, agenda: [], series: null, dream: '', diary: null }
    const next = { ...cur, ...patch, updated: Date.now() }
    this.db
      .prepare(
        'INSERT INTO days (day, agenda, series, dream, diary, updated) VALUES (?, ?, ?, ?, ?, ?) ' +
          'ON CONFLICT(day) DO UPDATE SET agenda=excluded.agenda, series=excluded.series, dream=excluded.dream, diary=excluded.diary, updated=excluded.updated',
      )
      .run(next.day, JSON.stringify(next.agenda), JSON.stringify(next.series), next.dream, JSON.stringify(next.diary), next.updated)
    return next
  }

  recentDays(n = 3) {
    return this.db
      .prepare('SELECT * FROM days ORDER BY day DESC LIMIT ?')
      .all(n)
      .map((r) => ({
        day: r.day,
        agenda: safeParse(r.agenda, []),
        series: safeParse(r.series, null),
        dream: r.dream || '',
        diary: safeParse(r.diary, null),
      }))
  }

  // ---- readings / journals / self ----
  addReading(r) {
    this.db
      .prepare(
        'INSERT INTO readings (id, bvid, title, author, summary, subtitle_ok, frames, tokens, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ' +
          'ON CONFLICT(id) DO UPDATE SET summary=excluded.summary, subtitle_ok=excluded.subtitle_ok, frames=excluded.frames, tokens=excluded.tokens',
      )
      .run(r.id, r.bvid, r.title || '', r.author || '', r.summary || '', r.subtitleOk ? 1 : 0, r.frames || 0, r.tokens || 0, Date.now())
    return r.id
  }

  reading(id) {
    return this.db.prepare('SELECT * FROM readings WHERE id = ?').get(id) || null
  }

  recentReadings(n = 5) {
    return this.db.prepare('SELECT * FROM readings ORDER BY created DESC LIMIT ?').all(n)
  }

  addJournal(j) {
    this.db
      .prepare('INSERT INTO journals (id, reading_id, day, content, facts, views, speculation, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(j.id, j.readingId || '', j.day, j.content, JSON.stringify(j.facts || []), JSON.stringify(j.views || []), JSON.stringify(j.speculation || []), Date.now())
    return j.id
  }

  recentJournals(n = 5) {
    return this.db
      .prepare('SELECT * FROM journals ORDER BY created DESC LIMIT ?')
      .all(n)
      .map((r) => ({
        id: r.id,
        readingId: r.reading_id,
        day: r.day,
        content: r.content,
        facts: safeParse(r.facts, []),
        views: safeParse(r.views, []),
        speculation: safeParse(r.speculation, []),
        created: r.created,
      }))
  }

  journalsOfDay(day) {
    return this.db.prepare('SELECT COUNT(*) AS n FROM journals WHERE day = ?').get(day)?.n || 0
  }

  addSelf(sentence, source) {
    const info = this.db
      .prepare('INSERT INTO self (sentence, source, rev, status, created) VALUES (?, ?, 1, ?, ?)')
      .run(sentence, source, 'active', Date.now())
    return Number(info.lastInsertRowid)
  }

  selfItems(status = 'active', n = 5) {
    const sql = status === 'all' ? 'SELECT * FROM self ORDER BY created DESC LIMIT ?' : 'SELECT * FROM self WHERE status = ? ORDER BY created DESC LIMIT ?'
    return status === 'all' ? this.db.prepare(sql).all(n) : this.db.prepare(sql).all(status, n)
  }

  selfCountOfDay(day) {
    const from = new Date(`${day}T00:00:00+08:00`).getTime()
    const to = from + 86400000
    return this.db.prepare('SELECT COUNT(*) AS n FROM self WHERE created >= ? AND created < ?').get(from, to)?.n || 0
  }

  reviseSelf(id, sentence) {
    this.db.prepare('UPDATE self SET sentence = ?, rev = rev + 1 WHERE id = ?').run(sentence, id)
  }

  revokeSelf(id) {
    this.db.prepare("UPDATE self SET status = 'revoked', rev = rev + 1 WHERE id = ?").run(id)
  }

  // ---- speak ----
  logSpeak(ts, umo, kind, score, fired, note = '') {
    this.db.prepare('INSERT INTO speak (ts, umo, kind, score, fired, note) VALUES (?, ?, ?, ?, ?, ?)').run(ts, umo, kind, score, fired ? 1 : 0, note)
  }

  recentSpeak(n = 20) {
    return this.db.prepare('SELECT * FROM speak ORDER BY ts DESC LIMIT ?').all(n)
  }

  speakCountOfDay(umo, day) {
    const from = new Date(`${day}T00:00:00+08:00`).getTime()
    const to = from + 86400000
    return this.db.prepare('SELECT COUNT(*) AS n FROM speak WHERE umo = ? AND ts >= ? AND ts < ? AND fired = 1').get(umo, from, to)?.n || 0
  }

  // ---- breathe（换气：打转记录，只记账不动手） ----
  logBreathe(ts, session, tool, args, count, warned) {
    this.db
      .prepare('INSERT INTO breathe (ts, session, tool, args, count, warned) VALUES (?, ?, ?, ?, ?, ?)')
      .run(ts, String(session ?? ''), String(tool ?? ''), String(args ?? '').slice(0, 300), count, warned ? 1 : 0)
  }

  recentBreathe(n = 10) {
    return this.db.prepare('SELECT * FROM breathe ORDER BY ts DESC LIMIT ?').all(n)
  }

  // ---- loops（未结：答应过还没做完的事） ----
  addLoop({ umo, text, kind = 'follow', due = null, note = '' }) {
    const now = Date.now()
    const r = this.db
      .prepare('INSERT INTO loops (umo, text, kind, due, status, created, note) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(umo, text, kind, due, 'open', now, note)
    return Number(r.lastInsertRowid)
  }

  openLoops(umo = null, limit = 5) {
    const rows = umo === null
      ? this.db.prepare("SELECT * FROM loops WHERE status = 'open' ORDER BY created ASC LIMIT ?").all(limit)
      : this.db.prepare("SELECT * FROM loops WHERE status = 'open' AND (umo = ? OR umo IS NULL) ORDER BY created ASC LIMIT ?").all(umo, limit)
    return rows
  }

  allLoops(umo = null, limit = 20) {
    const rows = umo === null
      ? this.db.prepare('SELECT * FROM loops ORDER BY status ASC, created DESC LIMIT ?').all(limit)
      : this.db.prepare('SELECT * FROM loops WHERE umo = ? OR umo IS NULL ORDER BY status ASC, created DESC LIMIT ?').all(umo, limit)
    return rows
  }

  closeLoop(id, status = 'done') {
    const r = this.db.prepare("UPDATE loops SET status = ?, closed = ? WHERE id = ? AND status = 'open'").run(status, Date.now(), id)
    return Number(r.changes) > 0
  }

  // ---- umos ----
  umo(umo) {
    return this.db.prepare('SELECT * FROM umos WHERE umo = ?').get(umo) || null
  }

  umos() {
    return this.db.prepare('SELECT * FROM umos').all()
  }

  touchIn(umo, ts, text, day) {
    this.db
      .prepare(
        'INSERT INTO umos (umo, last_in, last_in_text, day) VALUES (?, ?, ?, ?) ' +
          'ON CONFLICT(umo) DO UPDATE SET last_in=excluded.last_in, last_in_text=excluded.last_in_text, day=excluded.day',
      )
      .run(umo, ts, text, day)
  }

  touchOut(umo, ts) {
    this.db.prepare('UPDATE umos SET last_out = ? WHERE umo = ?').run(ts, umo)
  }

  markFire(umo, ts, kind, day) {
    this.db
      .prepare(
        'INSERT INTO umos (umo, last_fire, last_kind, last_kind_at, day, fires) VALUES (?, ?, ?, ?, ?, 1) ' +
          'ON CONFLICT(umo) DO UPDATE SET last_fire=excluded.last_fire, last_kind=excluded.last_kind, last_kind_at=excluded.last_kind_at, day=excluded.day, fires=fires+1',
      )
      .run(umo, ts, kind, ts, day)
  }

  // ---- usage ----
  usage(day) {
    const r = this.db.prepare('SELECT * FROM usage WHERE day = ?').get(day)
    return r || { day, requests: 0, reads: 0, tokens: 0 }
  }

  bumpUsage(day, { requests = 0, reads = 0, tokens = 0 }) {
    this.db
      .prepare(
        'INSERT INTO usage (day, requests, reads, tokens) VALUES (?, ?, ?, ?) ' +
          'ON CONFLICT(day) DO UPDATE SET requests=requests+excluded.requests, reads=reads+excluded.reads, tokens=tokens+excluded.tokens',
      )
      .run(day, requests, reads, tokens)
  }
}
