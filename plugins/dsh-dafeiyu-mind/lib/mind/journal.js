// 证据手账：她读到的东西，带来源、时间点、以及「事实 / 作者观点 / 我的推测」三栏
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

export function journalId(day) {
  return `j-${day}-${crypto.randomBytes(3).toString('hex')}`
}

export function writeJournal(root, entry) {
  const dir = path.join(root, '04工作区', '心智', '手账')
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, `${entry.day}-${entry.id}.md`)
  const lines = [
    `# ${entry.title || entry.readingId || entry.id}`,
    '',
    `- 日期：${entry.day}`,
    `- 来源：${entry.source || entry.readingId || '（无）'}`,
    '',
    '## 我记下的',
    entry.content || '',
    '',
    '## 事实',
    ...(entry.facts?.length ? entry.facts.map((x) => `- ${x}`) : ['- （没记）']),
    '',
    '## 作者的观点',
    ...(entry.views?.length ? entry.views.map((x) => `- ${x}`) : ['- （没记）']),
    '',
    '## 我的推测（不是事实）',
    ...(entry.speculation?.length ? entry.speculation.map((x) => `- ${x}`) : ['- （没记）']),
    '',
  ]
  fs.writeFileSync(file, lines.join('\n'), 'utf8')
  return file
}

export function indexLine(j) {
  const first = String(j.content || '')
    .replace(/\s+/g, ' ')
    .slice(0, 60)
  return `- ${j.day}｜${first}${first.length >= 60 ? '…' : ''}`
}
