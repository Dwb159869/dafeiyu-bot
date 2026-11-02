// comfyui-qwen provider：把本机 ComfyUI + Qwen-Image 2.1 接到 image-studio 的生成流程里
// 工作流结构与四个要点（LoadImage / vae / images.image_1 / latent 取第 2 号输出）参考
// dsh-qwen-paint（MIT, @奇迹与你），按 image-studio 的 provider 接口重写；见 NOTICE.md。
//
// 分支：
//   无参考图 → 文生图（EmptyLatentImage 决定尺寸）
//   1 张参考 → 编辑（参考图走 /upload/image，latent 由编码节点给）
//   多张参考 → 先用 ffmpeg 拼一张九宫格参考图，再走编辑分支（编码节点只吃一张图）
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

export const COMFY_DEFAULTS = {
  unet: 'qwen_image_2.1_int8_convrot.safetensors',
  clip: 'qwen3vl_8b_w4a8.safetensors',
  vae: 'qwen_image_2.1_vae_bf16.safetensors',
  steps: 25,
  resolution: 1024,
  cfgScale: 1.0,
  sampler: 'euler',
  scheduler: 'simple',
}

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }

function sniffImage(buf) {
  if (!buf || buf.length < 12) return ''
  if (buf[0] === 0x89 && buf[1] === 0x50) return '.png'
  if (buf[0] === 0xff && buf[1] === 0xd8) return '.jpg'
  if (buf.slice(0, 4).toString('latin1') === 'RIFF' && buf.slice(8, 12).toString('latin1') === 'WEBP') return '.webp'
  return ''
}

function packImages(buffers) {
  return buffers.map((data) => ({ data, ext: sniffImage(data) || '.png' }))
}

/** 3:4 → 约 1MP 的像素尺寸（Qwen-Image 的标准工作区间） */
export function pixelSize(aspect, base = 1024) {
  const m = /^(\d+):(\d+)$/.exec(String(aspect ?? ''))
  if (!m) return { width: base, height: base }
  const aw = Number(m[1])
  const ah = Number(m[2])
  if (!aw || !ah) return { width: base, height: base }
  const total = base * base
  const width = Math.round(Math.sqrt((total * aw) / ah) / 8) * 8
  const height = Math.round((total / width) / 8) * 8
  return { width: Math.max(256, width), height: Math.max(256, height) }
}

function comfyOf(cfg) {
  const api = cfg?.api ?? {}
  const c = cfg?.comfy ?? {}
  return {
    url: String(api.baseUrl || c.url || 'http://127.0.0.1:8188').replace(/\/+$/, ''),
    unet: String(c.unet || COMFY_DEFAULTS.unet),
    clip: String(c.clip || COMFY_DEFAULTS.clip),
    vae: String(c.vae || COMFY_DEFAULTS.vae),
    steps: Number(c.steps || COMFY_DEFAULTS.steps),
    resolution: Number(c.resolution || COMFY_DEFAULTS.resolution),
    cfgScale: Number(c.cfgScale || COMFY_DEFAULTS.cfgScale),
    sampler: String(c.sampler || COMFY_DEFAULTS.sampler),
    scheduler: String(c.scheduler || COMFY_DEFAULTS.scheduler),
    timeoutSec: Number(api.timeoutSec || 300),
  }
}

async function req(url, opts = {}) {
  const res = await fetch(url, opts)
  if (!res.ok) {
    let detail = ''
    try {
      detail = (await res.text()).slice(0, 300)
    } catch {}
    throw new Error(`ComfyUI ${url.replace(/^https?:\/\/[^/]+/, '')} 返回 ${res.status}${detail ? '：' + detail : ''}`)
  }
  return res
}

const DEFAULT_START_SCRIPT = '/home/example/dafeiyu-linux/tools/comfy-start.sh'

/**
 * 确保 ComfyUI 在线；没在线就拉起（脚本自己在后台 nohup，最多等 120 秒）。
 * 起不来也不报死错——留给后面 runComfy 的「连不上」提示。
 */
export async function ensureComfy(cfg, { waitMs = 120000 } = {}) {
  if (await comfyOnline(cfg)) return true
  const script = String(cfg?.comfy?.startScript || DEFAULT_START_SCRIPT)
  if (!existsSync(script)) return false
  try {
    spawn('bash', [script], { detached: true, stdio: 'ignore' }).unref()
  } catch {
    return false
  }
  const started = Date.now()
  while (Date.now() - started < waitMs) {
    await new Promise((r) => setTimeout(r, 1500))
    if (await comfyOnline(cfg)) return true
  }
  return false
}

export async function comfyOnline(cfg) {
  const c = comfyOf(cfg)
  try {
    await req(`${c.url}/system_stats`, { signal: AbortSignal.timeout(4000) })
    return true
  } catch {
    return false
  }
}

export function buildWorkflow(c, { prompt, negative = '', width, height, steps, seed, reference = '', references = [] }) {
  // references 优先：编码节点的 images 是 COMFY_AUTOGROW_V3，可以按 images.image_1..N 直接挂多张，
  // 不用再把参考图拼成一张（拼图会把留白带进画面，模型会当成画布去「编辑」）。
  const refs = (Array.isArray(references) ? references : []).filter((x) => typeof x === 'string' && x !== '')
  if (!refs.length && typeof reference === 'string' && reference !== '') refs.push(reference)
  const withRef = refs.length > 0
  const workflow = {
    1: { class_type: 'UNETLoader', inputs: { unet_name: c.unet, weight_dtype: 'default' } },
    2: { class_type: 'CLIPLoader', inputs: { clip_name: c.clip, type: 'qwen_image', device: 'default' } },
    3: { class_type: 'VAELoader', inputs: { vae_name: c.vae } },
    5: {
      class_type: 'TextEncodeQwenImage21',
      inputs: {
        clip: ['2', 0],
        prompt: prompt ?? '',
        negative_prompt: negative ?? '',
        resolution: withRef ? Math.round(Math.sqrt(width * height)) : c.resolution,
      },
    },
    7: { class_type: 'QwenImage21Cache', inputs: { model: ['1', 0], device: 'auto', dtype: 'default' } },
    9: { class_type: 'VAEDecode', inputs: { samples: ['8', 0], vae: ['3', 0] } },
    10: { class_type: 'SaveImage', inputs: { images: ['9', 0], filename_prefix: 'image-studio' } },
  }
  if (withRef) {
    workflow[5].inputs.vae = ['3', 0]
    refs.forEach((name, i) => {
      const id = String(100 + i)
      workflow[id] = { class_type: 'LoadImage', inputs: { image: name } }
      workflow[5].inputs[`images.image_${i + 1}`] = [id, 0]
    })
  } else {
    workflow[6] = { class_type: 'EmptyLatentImage', inputs: { width, height, batch_size: 1 } }
  }
  workflow[8] = {
    class_type: 'KSampler',
    inputs: {
      model: ['7', 0],
      seed,
      steps: Math.max(1, Math.min(60, steps)),
      cfg: c.cfgScale,
      sampler_name: c.sampler,
      scheduler: c.scheduler,
      positive: ['5', 0],
      negative: ['5', 1],
      latent_image: withRef ? ['5', 2] : ['6', 0],
      denoise: 1.0,
    },
  }
  return workflow
}

/** 用 ffmpeg 把多张参考图拼成一张（2 列网格，每格 512×512，等比缩放后补边） */
async function makeSheet(paths, outFile) {
  const n = paths.length
  const cols = n <= 2 ? n : 2
  const rows = Math.ceil(n / cols)
  const filters = []
  const labels = []
  for (let i = 0; i < n; i++) {
    filters.push(`[${i}:v]scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2,setsar=1[v${i}]`)
    labels.push(`[v${i}]`)
  }
  const rowLabels = []
  for (let r = 0; r < rows; r++) {
    const rowItems = labels.slice(r * cols, r * cols + cols)
    if (rowItems.length === 1) {
      filters.push(`${rowItems[0]}null[row${r}]`)
    } else {
      filters.push(`${rowItems.join('')}hstack=inputs=${rowItems.length}[row${r}]`)
    }
    rowLabels.push(`[row${r}]`)
  }
  if (rowLabels.length === 1) filters.push(`${rowLabels[0]}null[out]`)
  else filters.push(`${rowLabels.join('')}vstack=inputs=${rowLabels.length}[out]`)
  const args = ['-y', '-hide_banner', '-loglevel', 'error']
  for (const p of paths) args.push('-i', p)
  args.push('-filter_complex', filters.join(';'), '-map', '[out]', outFile)
  await new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let err = ''
    child.stderr.on('data', (d) => {
      err += String(d)
    })
    child.on('error', reject)
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error('ffmpeg 拼参考图失败：' + err.slice(0, 200)))))
  })
  return outFile
}

/**
 * 把参考图裁到目标比例（cover：先放大到铺满，再居中裁）。
 *
 * 为什么需要：图生图的 latent 由参考图编码得到，**输出尺寸跟参考图走**，
 * 传一张横版三视图进去，出来就是横版。
 * 为什么用裁不用补边：试过补白边——模型会把白边当成画布，直接往上面「编辑」，
 * 出来的是参考图加一块新画面的拼贴。裁到目标比例则保持整帧都是画面内容。
 */
async function fitRef(file, { width, height }, outFile) {
  const args = [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-i', file,
    '-filter_complex',
    `[0:v]scale=${width}:${height}:force_original_aspect_ratio=increase,` +
      `crop=${width}:${height},setsar=1[out]`,
    '-map', '[out]', outFile,
  ]
  await new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let err = ''
    child.stderr.on('data', (d) => {
      err += String(d)
    })
    child.on('error', reject)
    child.on('close', (code) => (code === 0 ? resolve(outFile) : reject(new Error('ffmpeg 补参考图失败：' + err.slice(0, 200)))))
  })
  return outFile
}

async function uploadImage(c, file, signal) {
  const buf = await readFile(file)
  const ext = sniffImage(buf) || path.extname(file) || '.png'
  const form = new FormData()
  form.append('image', new Blob([buf], { type: MIME[ext] || 'image/png' }), 'ref' + (MIME[ext] ? ext : '.png'))
  form.append('overwrite', 'true')
  const res = await req(`${c.url}/upload/image`, { method: 'POST', body: form, signal })
  const json = await res.json()
  const name = String(json?.name ?? '')
  if (!name) throw new Error('ComfyUI 没返回参考图文件名')
  return json?.subfolder ? `${json.subfolder}/${name}` : name
}

async function submit(c, workflow, signal) {
  const res = await req(`${c.url}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow, client_id: 'image-studio-' + Date.now() }),
    signal,
  })
  const json = await res.json()
  const id = String(json?.prompt_id ?? '')
  if (!id) throw new Error('ComfyUI 没返回 prompt_id：' + JSON.stringify(json).slice(0, 200))
  return id
}

async function waitForOutput(c, promptId, signal, onEvent) {
  const started = Date.now()
  let last = 0
  while (Date.now() - started < c.timeoutSec * 1000) {
    if (signal?.aborted) throw new Error('已取消')
    await new Promise((r) => setTimeout(r, 1200))
    let json
    try {
      const res = await req(`${c.url}/history/${promptId}`, { signal: AbortSignal.timeout(15000) })
      json = await res.json()
    } catch {
      continue
    }
    const entry = json?.[promptId]
    if (!entry) {
      // 还在跑，隔几秒报一次进度
      if (onEvent && Date.now() - last > 8000) {
        last = Date.now()
        onEvent({ type: 'progress', note: `ComfyUI 出图中（${Math.round((Date.now() - started) / 1000)}s）` })
      }
      continue
    }
    const status = entry?.status ?? {}
    if (status?.status_str === 'error') {
      const msg = (status?.messages ?? []).flat().filter((x) => typeof x === 'string').slice(-2).join(' ')
      throw new Error('ComfyUI 出图失败：' + (msg || '未知错误'))
    }
    const outputs = entry?.outputs ?? {}
    const files = []
    for (const node of Object.values(outputs)) {
      for (const img of node?.images ?? []) {
        if (img?.filename) files.push({ filename: img.filename, subfolder: img.subfolder ?? '', type: img.type ?? 'output' })
      }
    }
    if (files.length) return files
  }
  throw new Error(`等 ComfyUI 出图超时（${c.timeoutSec} 秒）`)
}

async function fetchImage(c, file, signal) {
  const q = new URLSearchParams({ filename: file.filename, subfolder: file.subfolder ?? '', type: file.type ?? 'output' })
  const res = await req(`${c.url}/view?${q.toString()}`, { signal })
  return Buffer.from(await res.arrayBuffer())
}

/**
 * image-studio 的 provider 入口
 * @param o {{cfg, prompt, refs: string[], aspect, signal, onEvent}}
 */
export async function runComfy({ cfg, prompt, refs = [], aspect, signal, onEvent }) {
  const c = comfyOf(cfg)
  if (!(await comfyOnline(cfg))) {
    onEvent?.({ type: 'progress', note: 'ComfyUI 没在跑，先把它拉起来（第一次要加载十几 G 模型）' })
    await ensureComfy(cfg)
  }
  if (!(await comfyOnline(cfg))) {
    throw new Error(
      `连不上本机 ComfyUI（${c.url}）。手动起一次看看：bash /home/example/dafeiyu-linux/tools/comfy-start.sh（日志在 state/comfyui.log）。`,
    )
  }
  const { width, height } = pixelSize(aspect, c.resolution)
  const list = Array.isArray(refs) ? refs.filter((p) => typeof p === 'string' && p && existsSync(p)) : []
  let tmp = ''
  let reference = ''
  try {
    const uploaded = []
    if (list.length) {
      tmp = await mkdtemp(path.join(tmpdir(), 'iref-'))
      for (let i = 0; i < Math.min(list.length, 4); i++) {
        const fitted = await fitRef(list[i], { width, height }, path.join(tmp, `ref${i}.png`))
        uploaded.push(await uploadImage(c, fitted, signal))
      }
      if (uploaded.length > 1) onEvent?.({ type: 'progress', note: `带上 ${uploaded.length} 张参考图（人物+服饰）` })
    }
    const seed = Math.floor(Math.random() * 2 ** 31)
    const workflow = buildWorkflow(c, { prompt, width, height, steps: c.steps, seed, references: uploaded })
    const id = await submit(c, workflow, signal)
    const files = await waitForOutput(c, id, signal, onEvent)
    const buffers = []
    for (const f of files.slice(0, 4)) buffers.push(await fetchImage(c, f, signal))
    if (!buffers.length) throw new Error('ComfyUI 说完成了，但没找到图片')
    return {
      images: packImages(buffers),
      meta: { taskId: id, model: `qwen-image-2.1 @ comfyui`, size: `${width}x${height}`, cost: null, remoteUrls: [] },
    }
  } finally {
    if (tmp) await rm(tmp, { recursive: true, force: true }).catch(() => {})
  }
}
