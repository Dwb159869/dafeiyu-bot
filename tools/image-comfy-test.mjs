// providers-comfy.js 的离线自测：不连 ComfyUI，只验工作流结构、尺寸换算与错误话术
import assert from 'node:assert/strict'
import { buildWorkflow, pixelSize, comfyOnline, runComfy } from '../plugins/dsh-image-studio/lib/providers-comfy.js'

// 离线用例：把 startScript 指到不存在的文件，避免自测时真去拉起 ComfyUI
const cfg = { api: { provider: 'comfyui-qwen', baseUrl: 'http://127.0.0.1:59999', timeoutSec: 5 }, comfy: { startScript: '/nonexistent/comfy-start.sh' } }
const c = { unet: 'u.safetensors', clip: 'c.safetensors', vae: 'v.safetensors', steps: 25, resolution: 1024, cfgScale: 1, sampler: 'euler', scheduler: 'simple', timeoutSec: 5 }

let n = 0
const ok = (name) => { n++; console.log('  ✓', name) }

// 文生图
const t2i = buildWorkflow(c, { prompt: 'a cat', width: 896, height: 1152, steps: 25, seed: 1 })
assert.equal(t2i[1].class_type, 'UNETLoader'); ok('UNETLoader 节点在')
assert.equal(t2i[2].inputs.type, 'qwen_image'); ok('CLIPLoader type=qwen_image')
assert.equal(t2i[6].class_type, 'EmptyLatentImage'); ok('文生图有 EmptyLatentImage')
assert.equal(t2i[8].inputs.latent_image[0], '6'); ok('文生图 latent 来自空 latent')
assert.equal(t2i[5].inputs.resolution, 1024); ok('文生图 resolution 用固定值')
assert.equal(t2i[5].inputs.vae, undefined); ok('文生图不给 vae')

// 图生图（单张，兼容旧参数名）
const i2i = buildWorkflow(c, { prompt: 'a cat', width: 896, height: 1152, steps: 25, seed: 1, reference: 'ref.png' })
assert.equal(i2i[100].class_type, 'LoadImage'); ok('图生图有 LoadImage')
assert.deepEqual(i2i[5].inputs.vae, ['3', 0]); ok('编码节点拿到 vae')
assert.deepEqual(i2i[5].inputs['images.image_1'], ['100', 0]); ok('参考图挂 images.image_1')
assert.equal(i2i[6], undefined); ok('图生图删掉 EmptyLatentImage')
assert.deepEqual(i2i[8].inputs.latent_image, ['5', 2]); ok('latent 取第 2 号输出')
assert.equal(i2i[5].inputs.resolution, Math.round(Math.sqrt(896 * 1152))); ok('图生图 resolution=sqrt(W*H)')

// 多张参考图：走 COMFY_AUTOGROW_V3 的 images.image_1..N，不拼图
const multi = buildWorkflow(c, { prompt: 'a cat', width: 888, height: 1184, steps: 25, seed: 1, references: ['a.png', 'b.png'] })
assert.deepEqual(multi[5].inputs['images.image_1'], ['100', 0]); ok('多图：第 1 张挂 image_1')
assert.deepEqual(multi[5].inputs['images.image_2'], ['101', 0]); ok('多图：第 2 张挂 image_2')
assert.equal(multi[101].inputs.image, 'b.png'); ok('多图：LoadImage 各自独立')
assert.equal(i2i[8].inputs.steps, 25); ok('steps 透传')
assert.equal(i2i[8].inputs.cfg, 1); ok('cfg 用配置值')

// 尺寸换算
const p1 = pixelSize('3:4'); assert.ok(p1.width < p1.height); ok(`3:4 → ${p1.width}x${p1.height}`)
const p2 = pixelSize('16:9'); assert.ok(p2.width > p2.height); ok(`16:9 → ${p2.width}x${p2.height}`)
const p3 = pixelSize('bogus'); assert.equal(p3.width, 1024); ok('非法比例回落 1024')

// 离线时给的是人话
const online = await comfyOnline(cfg)
assert.equal(online, false); ok('comfyOnline 离线返回 false')
let msg = ''
try { await runComfy({ cfg, prompt: 'x', refs: [], aspect: '3:4' }) } catch (e) { msg = String(e.message) }
assert.ok(/连不上本机 ComfyUI/.test(msg), '实际信息：' + msg); ok('离线报错是可读的')
assert.ok(/127\.0\.0\.1:59999/.test(msg)); ok('报错里带地址')

console.log(`\n${n} 项全过`)
