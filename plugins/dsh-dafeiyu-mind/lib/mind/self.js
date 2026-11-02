// 自我认识：human-world.md
// 规则：每天最多一句；每句必须带来源；可修订、可撤回；不进 persona.md
import fs from 'node:fs'
import path from 'node:path'

export const SELF_MAX_PER_DAY = 1

export function selfFile(root) {
  return path.join(root, '04工作区', '心智', 'human-world.md')
}

export function appendSelf(root, sentence, source, day) {
  const file = selfFile(root)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  if (!fs.existsSync(file)) {
    fs.writeFileSync(
      file,
      '# 我看见的人类世界\n\n> 这是大肥鱼自己从读到的东西里留下的认识，每天最多一句，都带来源。\n> 修订或撤回请让她用 mind_self 操作，不要手改下面的条目。\n\n',
      'utf8',
    )
  }
  const line = `- [${day}] ${sentence}\n  —— 来源：${source}\n`
  fs.appendFileSync(file, line, 'utf8')
  return line
}

export function selfContext(items, limit = 300) {
  if (!items?.length) return ''
  const picked = []
  let used = 0
  for (const it of items) {
    const s = `· ${it.sentence}`
    if (used + s.length > limit) break
    picked.push(s)
    used += s.length
  }
  if (!picked.length) return ''
  return `【你读过的东西留下的认识】\n${picked.join('\n')}\n（这些是你自己慢慢想明白的，聊天时自然带出来就行，别当成引用念。）`
}
