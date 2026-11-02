# NOTICE

本目录是 **dsh-image-studio v0.5.0** 的本地改动版（上游：`aa1355721445-lgtm/dsh-image-studio`，MIT）。

## 本仓库改了什么

| 文件 | 改动 |
|---|---|
| `lib/providers-comfy.js` | **新增**：`comfyui-qwen` provider，把本机 ComfyUI + Qwen-Image 2.1 接进生图流程 |
| `lib/providers.js` | 分发处加一行 `if (cfg.api.provider === 'comfyui-qwen') return runComfy(opts)`，顶部加 import |
| `lib/store.js` | `PROVIDERS` 加 `comfyui-qwen`（默认 `http://127.0.0.1:8188`）；`DEFAULT_CONFIG` 加 `comfy` 块（三个模型名/步数/cfg）；`normalizeConfig` 收敛 `comfy` 并让 `baseUrl` 按 provider 取默认值 |

## 第三方来源

- **dsh-qwen-paint**（`wonderandyou/dsh-qwen-paint`，MIT，作者 @奇迹与你）：`providers-comfy.js` 的 ComfyUI 工作流结构与「图生图四要点」（`LoadImage` / 编码节点给 `vae` / 参考图挂 `images.image_N` / latent 取编码节点第 2 号输出并删掉 `EmptyLatentImage`）、`/upload/image` 上传、`/history` + `/view` 取图，都来自该项目。本目录按 image-studio 的 provider 接口重写，未复制其插件骨架与 UI。
- **dsh-image-studio**（`aa1355721445-lgtm/dsh-image-studio`，MIT）：本目录主体（参考库、compose、engine、设置页）仍是上游代码，仅做上表所列改动。

## 与上游的偏差（重装会丢）

- 重装 `dsh-image-studio` 会覆盖 `providers.js` / `store.js` 的两处补丁，`providers-comfy.js` 与 `~/.dsh/image-studio/config.json` 的 `comfy` 块需要重新放回。
