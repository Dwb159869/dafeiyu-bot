#!/usr/bin/env node
// 门牌巡检：摘要/记忆里指过去的那扇门，门后还有东西吗？
// 2026-11-02 吸收自「陪伴型 AI 资料全集」那条热评：错的门牌比没有更坏。
//   · companion.db 的 memories.source_session 指向的会话还在不在
//   · mind.db 的 readings 指向的取稿缓存还在不在
// 用法：node tools/mind-door-audit.mjs [--fix]
//   --fix 只做一件事：把指不到的 source_session 清空（标成“来源没验过”），不删记忆。
import fs from 'node:fs'
import path from 'node:path'
import { homedir } from 'node:os'
import { DatabaseSync } from 'node:sqlite'

const FIX = process.argv.includes('--fix')
const HOME = homedir()
const SESSIONS = path.join(HOME, '.dsh', 'sessions')
const COMPANION = path.join(HOME, '.dsh', 'companion', 'companion.db')
const MIND = path.join(HOME, 'dafeiyu-linux', '大肥鱼小窝', '04工作区', '心智', 'mind.db')
const READ_CACHE = path.join(HOME, 'dafeiyu-linux', '大肥鱼小窝', '04工作区', '心智', '取稿')

function sessionExists(id) {
  if (typeof id !== 'string' || id === '') return false
  const roots = fs.existsSync(SESSIONS) ? fs.readdirSync(SESSIONS) : []
  for (const ws of roots) {
    const dir = path.join(SESSIONS, ws, id)
    if (fs.existsSync(dir)) return true
  }
  return false
}

function openDb(file) {
  if (!fs.existsSync(file)) return null
  try {
    return new DatabaseSync(file, { readOnly: !FIX })
  } catch {
    return null
  }
}

const report = []

// —— 1. 长期记忆的来源会话 ——
const cdb = openDb(COMPANION)
let memoryRows = []
if (cdb !== null) {
  try {
    memoryRows = cdb.prepare("SELECT id, substr(content,1,60) AS snippet, source_session FROM memories WHERE status='active'").all()
  } catch (e) {
    report.push(`读 companion.db 失败：${e.message}`)
  }
}
const danglingMemories = memoryRows.filter((r) => r.source_session && !sessionExists(r.source_session))
report.push(`长期记忆 ${memoryRows.length} 条，带来源的 ${memoryRows.filter((r) => r.source_session).length} 条，指不到会话的 ${danglingMemories.length} 条`)
for (const r of danglingMemories.slice(0, 10)) report.push(`  · #${r.id} ${r.snippet}… → ${r.source_session}（会话不在了）`)
if (FIX && cdb !== null && danglingMemories.length > 0) {
  const stmt = cdb.prepare('UPDATE memories SET source_session = NULL WHERE id = ?')
  for (const r of danglingMemories) stmt.run(r.id)
  report.push(`已把 ${danglingMemories.length} 条记忆的来源清空（记忆本身没删）`)
}
cdb?.close()

// —— 2. 取稿记录的缓存文件 ——
const mdb = openDb(MIND)
let reads = []
if (mdb !== null) {
  try {
    reads = mdb.prepare('SELECT id, bvid FROM readings').all()
  } catch {
    /* 表可能还不存在 */
  }
}
let missingCache = 0
for (const r of reads) {
  const f1 = path.join(READ_CACHE, `${r.bvid}.txt`)
  const f2 = path.join(READ_CACHE, `${r.bvid}.scan.json`)
  if (!fs.existsSync(f1) && !fs.existsSync(f2)) missingCache += 1
}
report.push(`取稿记录 ${reads.length} 条，本地没有缓存的 ${missingCache} 条（不算错，重读一次就有）`)
mdb?.close()

console.log(report.join('\n'))
const bad = danglingMemories.length
process.exit(bad > 0 && !FIX ? 1 : 0)
