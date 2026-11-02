// 生活状态的持久化：node:sqlite（Node 22.13+ 内置，不用装依赖）
// 库放在小窝里，备份和迁移跟着小窝走：<root>/04工作区/生活/life.db
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

function safeParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export class LifeStore {
  constructor(dbFile) {
    fs.mkdirSync(path.dirname(dbFile), { recursive: true });
    this.db = new DatabaseSync(dbFile);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts INTEGER NOT NULL,
        kind TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        mood REAL NOT NULL DEFAULT 0,
        energy REAL NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_events_ts ON events (ts);
      CREATE TABLE IF NOT EXISTS umos (
        umo TEXT PRIMARY KEY,
        category TEXT NOT NULL DEFAULT 'master',
        last_in INTEGER NOT NULL DEFAULT 0,
        last_in_text TEXT NOT NULL DEFAULT '',
        last_out INTEGER NOT NULL DEFAULT 0,
        last_fire INTEGER NOT NULL DEFAULT 0,
        last_kind TEXT NOT NULL DEFAULT '',
        last_kind_at INTEGER NOT NULL DEFAULT 0,
        day TEXT NOT NULL DEFAULT '',
        fires INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS decisions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts INTEGER NOT NULL,
        umo TEXT NOT NULL,
        kind TEXT NOT NULL,
        score REAL NOT NULL DEFAULT 0,
        fired INTEGER NOT NULL DEFAULT 0,
        note TEXT NOT NULL DEFAULT ''
      );
      CREATE INDEX IF NOT EXISTS idx_decisions_ts ON decisions (ts);
      CREATE TABLE IF NOT EXISTS days (
        day TEXT PRIMARY KEY,
        agenda TEXT NOT NULL DEFAULT '',
        series TEXT NOT NULL DEFAULT '',
        dream TEXT NOT NULL DEFAULT '',
        updated INTEGER NOT NULL DEFAULT 0
      );
    `);
    this.getState = this.db.prepare('SELECT value FROM meta WHERE key = ?');
    this.putState = this.db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
    this.addEventStmt = this.db.prepare('INSERT INTO events (ts, kind, note, mood, energy) VALUES (?, ?, ?, ?, ?)');
    this.recentStmt = this.db.prepare('SELECT ts, kind, note, mood, energy FROM events ORDER BY id DESC LIMIT ?');
    this.touchInStmt = this.db.prepare(`INSERT INTO umos (umo, category, last_in, last_in_text) VALUES (?, ?, ?, ?)
      ON CONFLICT(umo) DO UPDATE SET category = excluded.category, last_in = excluded.last_in, last_in_text = excluded.last_in_text`);
    this.touchOutStmt = this.db.prepare(`INSERT INTO umos (umo, last_out) VALUES (?, ?)
      ON CONFLICT(umo) DO UPDATE SET last_out = excluded.last_out`);
    this.getUmoStmt = this.db.prepare('SELECT * FROM umos WHERE umo = ?');
    this.listUmosStmt = this.db.prepare('SELECT * FROM umos ORDER BY last_in DESC');
    this.fireStmt = this.db.prepare(`UPDATE umos SET last_fire = ?, last_kind = ?, last_kind_at = ?,
      fires = CASE WHEN day = ? THEN fires + 1 ELSE 1 END, day = ? WHERE umo = ?`);
    this.decisionStmt = this.db.prepare('INSERT INTO decisions (ts, umo, kind, score, fired, note) VALUES (?, ?, ?, ?, ?, ?)');
    this.decisionsStmt = this.db.prepare('SELECT ts, umo, kind, score, fired, note FROM decisions ORDER BY id DESC LIMIT ?');
    this.getDayStmt = this.db.prepare('SELECT day, agenda, series, dream, updated FROM days WHERE day = ?');
    this.putDayStmt = this.db.prepare(`INSERT INTO days (day, agenda, series, dream, updated) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(day) DO UPDATE SET agenda = excluded.agenda, series = excluded.series, dream = excluded.dream, updated = excluded.updated`);
    this.recentDaysStmt = this.db.prepare('SELECT day, agenda, series, dream, updated FROM days ORDER BY day DESC LIMIT ?');
  }

  load(nowMs) {
    const row = this.getState.get('state');
    if (!row?.value) return null;
    try {
      const parsed = JSON.parse(row.value);
      if (parsed && typeof parsed === 'object' && Number.isFinite(Number(parsed.lastTick))) return parsed;
    } catch {
      /* 坏数据就当没有，重新开始 */
    }
    return null;
  }

  save(state) {
    this.putState.run('state', JSON.stringify(state));
  }

  record(nowMs, kind, note, state) {
    this.addEventStmt.run(
      Math.round(nowMs),
      String(kind),
      String(note ?? ''),
      Math.round(Number(state?.mood ?? 0)),
      Math.round(Number(state?.energy ?? 0)),
    );
  }

  recent(limit = 8) {
    return this.recentStmt.all(Math.max(1, Math.min(50, Number(limit) || 8)));
  }

  touchIn(umo, category, text, ts) {
    this.touchInStmt.run(String(umo), String(category), Math.round(ts), String(text ?? '').slice(0, 300));
  }

  touchOut(umo, ts) {
    this.touchOutStmt.run(String(umo), Math.round(ts));
  }

  umo(umo) {
    return this.getUmoStmt.get(String(umo)) ?? null;
  }

  umos() {
    return this.listUmosStmt.all();
  }

  fire(umo, kind, ts) {
    const day = new Date(ts + 8 * 3600_000).toISOString().slice(0, 10); // 按北京时间算一天
    this.fireStmt.run(Math.round(ts), String(kind), Math.round(ts), day, day, String(umo));
  }

  decision(ts, umo, kind, score, fired, note = '') {
    this.decisionStmt.run(Math.round(ts), String(umo), String(kind), Number(score) || 0, fired ? 1 : 0, String(note ?? ''));
  }

  decisions(limit = 20) {
    return this.decisionsStmt.all(Math.max(1, Math.min(100, Number(limit) || 20)));
  }

  /** 某天的安排/剧集/梦；没有就返回 null */
  day(day) {
    const row = this.getDayStmt.get(String(day));
    if (!row) return null;
    return {
      day: String(row.day),
      agenda: row.agenda ? safeParse(row.agenda) : null,
      series: row.series ? safeParse(row.series) : null,
      dream: String(row.dream ?? ''),
      updated: Number(row.updated ?? 0),
    };
  }

  saveDay(day, patch = {}) {
    const cur = this.day(day) ?? { agenda: null, series: null, dream: '', updated: 0 };
    this.putDayStmt.run(
      String(day),
      JSON.stringify(patch.agenda ?? cur.agenda ?? null),
      JSON.stringify(patch.series ?? cur.series ?? null),
      String(patch.dream ?? cur.dream ?? ''),
      Date.now(),
    );
  }

  recentDays(limit = 7) {
    return this.recentDaysStmt.all(Math.max(1, Math.min(30, Number(limit) || 7))).map((row) => ({
      day: String(row.day),
      agenda: row.agenda ? safeParse(row.agenda) : null,
      series: row.series ? safeParse(row.series) : null,
      dream: String(row.dream ?? ''),
      updated: Number(row.updated ?? 0),
    }));
  }

  close() {
    try {
      this.db.close();
    } catch {
      /* 关不掉就算了 */
    }
  }
}
