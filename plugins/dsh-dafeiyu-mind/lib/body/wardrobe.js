// 衣柜/场景：从 image-studio 的参考库里读名字，给日程的 detail 和注入用
// 没有装 image-studio 时整段静默跳过（返回空数组），不影响任何别的功能。
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const CATS = [
  ['characters', '人物'],
  ['outfits', '服饰'],
  ['scenes', '场景'],
  ['props', '道具'],
]

export function libraryRoot(override = '') {
  if (override && String(override).trim() !== '') return String(override).trim()
  const home = process.env.DSH_HOME || path.join(process.env.HOME || os.homedir(), '.dsh')
  return path.join(home, 'image-studio', 'library')
}

function readMeta(dir) {
  const file = path.join(dir, 'entry.json')
  try {
    if (!existsSync(file)) return {}
    const obj = JSON.parse(readFileSync(file, 'utf8'))
    return obj && typeof obj === 'object' ? obj : {}
  } catch {
    return {}
  }
}

/** 扫一个分类：返回 [{cat, name, situations, defaultOutfit, description}] */
function scanCat(root, cat) {
  const dir = path.join(root, cat)
  const out = []
  try {
    if (!existsSync(dir)) return out
    for (const name of readdirSync(dir).slice(0, 200)) {
      const full = path.join(dir, name)
      try {
        if (!statSync(full).isDirectory()) continue
      } catch {
        continue
      }
      const meta = readMeta(full)
      out.push({
        cat,
        name: String(meta.name ?? name).slice(0, 40),
        situations: meta.situationOutfits && typeof meta.situationOutfits === 'object' ? meta.situationOutfits : {},
        defaultOutfit: typeof meta.defaultOutfit === 'string' ? meta.defaultOutfit.slice(0, 40) : '',
        description: typeof meta.description === 'string' ? meta.description.slice(0, 120) : '',
      })
    }
  } catch {}
  return out
}

export function loadWardrobe(override = '') {
  const root = libraryRoot(override)
  const all = []
  for (const [cat] of CATS) all.push(...scanCat(root, cat))
  return all
}

/** 给提示词的一行行名字（按分类分组，最多 40 个） */
export function wardrobePrompt(items) {
  const list = Array.isArray(items) ? items : []
  if (!list.length) return []
  const by = new Map()
  for (const it of list) {
    const label = (CATS.find(([c]) => c === it.cat) ?? [null, it.cat])[1]
    if (!by.has(label)) by.set(label, [])
    by.get(label).push(it.name)
  }
  const out = []
  for (const [label, names] of by) out.push(`${label}：${names.slice(0, 16).join('、')}`)
  return out
}

const SITUATION_HINTS = [
  [/睡|床|起/, '居家'],
  [/洗漱|洗澡/, '居家'],
  [/上班|工位|公司|加班|开会|通勤/, '上班'],
  [/散步|逛街|出门|外面|路上|公园|海边|展/, '外出'],
  [/收拾|打扫|做饭|家务|洗衣/, '居家'],
  [/剧|电影|游戏/, '居家'],
  [/吃饭|午饭|晚饭|外卖|店/, '居家'],
]

function guessSituation(activity) {
  for (const [re, name] of SITUATION_HINTS) if (re.test(activity)) return name
  return ''
}

/**
 * 给每一段补 outfit / scene（只在模型没写、而库里恰好有匹配时补）。
 * 人物条目里 situationOutfits = {情境: 服饰名}，按段落的 activity 猜情境。
 */
export function linkItems(items, wardrobe, personaName = '') {
  const list = Array.isArray(items) ? items : []
  const w = Array.isArray(wardrobe) ? wardrobe : []
  if (!w.length) return list
  const scenes = w.filter((x) => x.cat === 'scenes').map((x) => x.name)
  const outfits = w.filter((x) => x.cat === 'outfits').map((x) => x.name)
  const her = w.find((x) => x.cat === 'characters' && personaName && x.name === personaName) ?? w.find((x) => x.cat === 'characters')
  return list.map((it) => {
    const next = { ...it }
    const situation = guessSituation(it.activity ?? it.what ?? '')
    if (situation) next.situation = situation
    if (!next.outfit && her) {
      const bySituation = situation ? her.situations?.[situation] : ''
      if (bySituation) next.outfit = bySituation
      else if (her.defaultOutfit) next.outfit = her.defaultOutfit
    }
    if (!next.outfit && outfits.length) next.outfit = outfits[0]
    if (!next.scene && scenes.length) {
      const guess = scenes.find((s) => situation && s.includes(situation)) ?? ''
      if (guess) next.scene = guess
    }
    return next
  })
}
