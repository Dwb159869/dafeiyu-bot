# 第三方代码声明

本项目的消息转换和收发逻辑移植自以下项目，按其许可证保留署名。

## AstrBot

- 来源：<https://github.com/AstrBotDevs/AstrBot>（4.29.1）
- 许可证：GNU Affero General Public License v3.0 or later
- 移植的文件：
  - `astrbot/core/platform/sources/aiocqhttp/aiocqhttp_platform_adapter.py` → `src/adapter.ts`
  - `astrbot/core/platform/sources/aiocqhttp/aiocqhttp_message_event.py` → `src/adapter.ts`
  - `astrbot/core/platform/astrbot_message.py`、`message_type.py` → `src/adapter.ts`
  - `astrbot/core/message/components.py` → `src/components.ts`
  - `astrbot/core/pipeline/respond/stage.py`（群回复头仅附加在首条文字、语音独立发送的行为参考；对象绑定与设置由本插件实现）→ `src/bridge.ts`
  - `astrbot/core/pipeline/waking_check/stage.py`（唤醒判断部分）→ `src/bridge.ts`
  - `astrbot/core/utils/quoted_message/chain_parser.py`、`extractor.py`、`onebot_client.py` → `src/quoted.ts`
  - `astrbot/core/pipeline/whitelist_check/stage.py`、`rate_limit_check/stage.py`、`astr_main_agent.py`（`_append_system_reminders`）、`builtin_stars/astrbot/main.py`（`handle_empty_mention`）、`builtin_stars/builtin_commands`（指令的权限规则）→ `src/bridge.ts`

由于移植了 AGPL 代码，本项目整体以 AGPL-3.0-or-later 发布，见 `LICENSE`。

## QFace（小黄脸编号和名字）

- 来源：<https://github.com/koishijs/QFace>
  - 仓库 `public/assets/qq_emoji/_index.v2.json`（提交 `20ab855`，2026-09-28 从 QQ 同步）里数字编号表情的编号和名字，优先使用；
  - 上面没有的旧编号，用 npm 包 `qface` 1.4.1 的 `lib/data.json` 补上。
- 许可证：MIT，Copyright (c) 2020-present Shigma。许可文本与下面 aiocqhttp 一节的 MIT 许可全文相同（版权人换成 Shigma）。
- 用到的部分：只有编号和名字 → `src/qface.ts`，不含图片和动画。表情名字本身属于 QQ（腾讯）。

## aiocqhttp

- 来源：<https://github.com/nonebot/aiocqhttp>（1.4.4）
- 移植的部分：反向 WebSocket 服务、API 调用与结果匹配、事件总线 → `src/onebot/`

```
The MIT License (MIT)
Copyright (c) 2017 Richard Chien

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

## ffmpeg（不随本插件分发）

设置页「视频」里的一键安装会在运行时从 <https://github.com/BtbN/FFmpeg-Builds>（构建脚本 MIT）下载 FFmpeg 的 LGPL 版独立程序，核对 SHA256 后放进 `<DSH_HOME>/napcat-bridge/ffmpeg/`。FFmpeg 本身按 LGPL-2.1-or-later 授权（<https://ffmpeg.org/legal.html>），本仓库不包含它的任何代码或程序。

---

## lobe-icons（服务商 logo）

设置页里服务商的 logo 取自 [lobehub/lobe-icons](https://github.com/lobehub/lobe-icons)（npm 包 `@lobehub/icons-static-svg` 1.98.0），以 data: 图片内嵌在 `src/client/client.js` 里。这些 logo 是各厂商的商标，归各厂商所有，这里只用来在设置页里辨认服务商。

MIT License

Copyright (c) 2023 LobeHub

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
