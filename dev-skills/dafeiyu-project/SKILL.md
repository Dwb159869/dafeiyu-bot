---
name: dafeiyu-project
description: 开发或维护大肥鱼机器人本体时使用：项目目录地图、DSH/QQ/SnowLuma 部署链路、本地插件源码与部署副本、profile 预设、验证、备份与回滚。
---

# 大肥鱼机器人项目

## 它是什么

一台 Ubuntu 机器上跑的 QQ 陪伴机器人，宿主是系统 DSH（DeepSeek Harness，端口 **3080**，`DSH_HOME=/home/example/.dsh`）。QQ 走 SnowLuma（WebUI 5099）+ OneBot 反向 WS 到 `napcat-bridge`；人格、长期记忆、日记、主动关怀由 `dsh-companion-core` 提供，QQ 会话用 `companion` 预设。容器方案已停用，只用本机 systemd。

systemd 用户单元：`deepseek-harness.service`（系统 DSH）、`dafeiyu-native-snowluma.service`、`dafeiyu-native-qq.service`。

## 目录地图

工作区 `/home/example/dafeiyu-linux`：

- `start.sh` / `stop.sh` / `status.sh` / `logs.sh [dsh|snowluma|qq|ollama]` / `model.sh`：日常运维入口。`start.sh` 起 DSH + SnowLuma + QQ 并打开面板；`stop.sh` 只停 QQ 和 SnowLuma。
- `app/`：初始化与兼容补丁。`init.mjs` 把 `plugins/`、`vendor/` 复制进 profile 并生成预设；`patch-companion.mjs`、`patch-at-file-compat.py`、`patch-genui-compat.py` 修改 node_modules 里的第三方包；`qq-status.py` 查 QQ/OneBot 状态；`persona.md` 只是初始人格模板。
- `plugins/`：五个本地插件源码（`dsh-dafeiyu-qq-tools`、`dsh-dafeiyu-runtime`、`dsh-dafeiyu-vault`、`dsh-remember-you`、`dsh-dafeiyu-mind`），**这是源头**。`dsh-dafeiyu-life` 与 `dsh-bili-whale` 已停用保留，别在它们上面加功能。
- `dev-preset/`：本次新增的「开发模式」bundle（`dafeiyu-dev` 预设声明）。
- `dev-skills/`：开发模式挂载的项目技能目录。
- `vendor/`：`dsh-companion-core-0.17.1.tgz`、`dsh-napcat-bridge-0.20.4.tgz`。
- `profile/`、`compose.yaml`、`Dockerfile`：已停用的容器方案，别再拿来起服务。
- `native/`：停用的独立 DSH 实例，以及仍在用的 SnowLuma/QQ 运行时与日志（`native/logs/`）。
- `backups/`：改动前备份，含补丁前的第三方文件原件。
- `大肥鱼小窝/`（`vault` 软链指向它）：机器人文件小窝，结构见 `使用规则.md`。
- `README.md`、`本机运行说明.md`、`自定义设定安装说明.md`：现状说明；改架构后同步更新。

运行数据 `/home/example/.dsh`：

- `profiles/web/cordis.patch.yml`：**真正生效的 profile 补丁**（模型、QQ 桥接、companion-core、vault、remember-you、预设）。
- `profiles/web/package.json`：`dsh.profile.bundles` 列表；本地插件以 `link:` 指向 `profiles/web/plugins/`。
- `profiles/web/plugins/`：插件的**部署副本**，运行中的就是这份。
- `profiles/web/node_modules/`：宿主包与第三方包；`dsh-companion-core`、`dsh-napcat-bridge`、`dsh-genui`、`dsh-at-file` 被补丁脚本改过。
- `companion/persona/persona.md`：运行中的大肥鱼人格。
- `companion/companion.db`：记忆与存档数据库；`companion/backups/` 是自动备份。
- 日志：`/home/example/.local/state/deepseek-harness/server.log`。

## 开发流程

1. 改项目文件（`app/`、`plugins/`、脚本、文档）。
2. 本地插件：改 `plugins/<name>/lib/`，用 `node --check` 或真实 import 验证，再同步到 `~/.dsh/profiles/web/plugins/<name>/`；宿主只在启动/重装时重读插件，改完需要重启 DSH 才生效。
3. 宿主补丁：先备份原文件到 `backups/`；脚本保持幂等（已应用就跳过、宿主接口变了就明确报错）；重装依赖后会覆盖，需要重新执行。
4. 新增/修改预设：预设是 `@deepseek-ai/dsh-agent-preset` 声明，写在 profile 补丁或已安装 bundle 的 patch 里；用 `plugin_manager install_bundle` 安装本地 bundle，用 `cordis_inspect_list` / `cordis_inspect_query` 读真实 Config schema。**旧会话沿用旧插件版本**，改完在新会话验证。
5. 验证：`bash status.sh`、`bash logs.sh dsh|qq`、新会话试跑或真实发一条 QQ；异常先看 `server.log`。

## 重启与影响

- `systemctl --user restart deepseek-harness.service`：重启宿主，3080 界面会断开重连，进行中的回复会中断；会话记录保留。
- `bash stop.sh` / `systemctl --user start dafeiyu-native-qq.service`：只影响 QQ 桥接，不影响网页会话。
- 改 `cordis.patch.yml` 后需要让宿主重新加载（重启或用 plugin_manager 触发）；不确定时先问用户。

## 表情包（meme 子系统）

- 图库在 `大肥鱼小窝/02资料库/表情包/`：`索引.json` 是插件唯一读的清单，`手工归类.json` 是人工覆盖，`收自主人/` 存机器人从聊天里收的图，`使用记录.jsonl` 记发送历史。分类说明见同目录 `分类说明.md`。
- 工具：`meme_catalog`/`meme_search`/`meme_send`/`meme_collect`，以及 **`meme_send_image`**（本机图片当表情发；`keep=true` 收进 `自制/年-月/` 并写索引+向量）。自己生表情：`image_generate`（aspect 1:1）→ `meme_send_image`。
- 冒烟：`node /tmp/memetest/run.mjs`（假桥接；`meme_send_image` 要用独立 session 才绕得开 8 秒冷却）。
- 分类体系只有一份定义：`tools/meme-taxonomy.mjs` 的 `TAXONOMY`（18 个中文类，每类 kind/desc/use/avoid/kw/near）和 `SLUG_MAP`；插件（`plugins/dsh-dafeiyu-vault/lib/meme-ranking.js`）和索引导出器 `tools/meme-reindex.mjs` 都从这里取。
- 改分类或加图后：`node tools/meme-reindex.mjs` 重建索引，`node tools/meme-search-test.mjs` 验收排序与轮换；插件侧检索逻辑是纯函数，可直接跑测试，不用起宿主。
- 检索规则：点名分类且有图 → 只在该类内排序；点名分类但没图 → 返回空并给相邻类建议，绝不跨类凑数。
- 打分（`lib/meme-ranking.js`）：类别命中 +12、关键词命中类别 +8、note 命中词 +3、tag 命中 +3、bge-m3 语义相似度加最多约 11；`pickBest` 取最高分同分随机，**不做时间窗轮换**，同一张可以重复用。
- 语义层：`语义向量.json` 由 `node tools/meme-embed.mjs` 生成（bge-m3，ollama 127.0.0.1:11434），插件里 `embedQuery` 超时 2.5s 就自动退化纯关键词；收录新图时插件会顺手补向量。
- 逐张标注：`视觉标注.json` 存看图写下的 note/tags/cat（合并脚本 `tools/meme-vision-merge.mjs`），有了它 `meme-reindex.mjs` 才会写出不重复的 note；索引里没有 note 就等于只能按类别模板匹配。
- 插件改动仍需同步到 `~/.dsh/profiles/web/plugins/dsh-dafeiyu-vault/` 并重启 DSH 才生效；冒烟测试可用 `/tmp/memetest/run.mjs` 的假 ctx 方式。

## 规则

- 动手前先读 `本机运行说明.md` 和对应源码；路径不确定就查，不要猜。
- 改 `~/.dsh`、人格、记忆库、桥接配置前备份到 `backups/before-<事由>-<时间>/`。
- 不删备份；不泄露 `.env`、`管理界面入口.txt`、OneBot 令牌、QQ 密码。
- 不擅自改默认模型、默认预设、QQ 白名单；不擅自停 QQ 服务。
- 报告写清：改了哪些文件、验证结果、怎么回滚（具体备份目录或文件）。

## 心智层（mind 子系统）

- 源码 `plugins/dsh-dafeiyu-mind/`，部署副本 `~/.dsh/profiles/web/plugins/dsh-dafeiyu-mind/`；旧的 life / bili-whale 已在 profile 补丁里 `disabled: true`，回滚就是去掉这两行。
- 结构：`lib/body/`（engine 状态引擎、planner 日程规则、planner-llm 提示词与解析、plan-inject 注入文案、wardrobe 衣柜、agenda 剧集与梦）、`lib/speak/proactive.js`（主动消息候选）、`lib/core/`（db / gate / budget）、`lib/feed/bili.js`（调 vendor 里的 bili-whale CLI）、`lib/mind/`（journal 手账、self 自我认识、soul SELF.md、breathe 换气）、`lib/index.js`（Config、注入、唯一 tick、14 个工具）。
- 库：`大肥鱼小窝/04工作区/心智/mind.db`（表：meta/events/days/readings/journals/self/speak/usage/umos/loops/breathe）；手账正文在 `04工作区/心智/手账/`，自我认识在 `04工作区/心智/human-world.md`，SELF.md 与 `权威源.md` 也在同目录。
- 两个新机制（借 dsh-agent-soul v2）：**未结** `mind_open`（答应的事留痕，每轮注入最多三条）；**换气**（同一工具同样参数第 3 次起插一句「先停一下」，只提醒不删内容；见 `lib/mind/breathe.js`，配置 `breatheEnabled/breatheThreshold/breatheWindowMinutes`）。
- 工具：`mind_status/mind_day/mind_dream/mind_event/mind_sleep/mind_read/mind_share/mind_journal/mind_self/mind_soul/mind_open/mind_speak/mind_budget/mind_life`；人格里写的就是这些名字，改名要同步 `persona.md`。
- 日程是模型排的（借 dsh-daily-schedule 的设计，见 `NOTICE.md`）：每晚 `planHour` 排明天，失败退模板；`mind_day` 的 `adjust/remake` 可改、可重排；`injectScope=session` 时用 `mind_life` 按会话开关。
- 改完验证：`node --check lib/index.js`，纯函数测试 `node tools/mind-planner-test.mjs`、`node tools/life-*-test.mjs`，整插件冒烟 `/tmp/mindtest/smoke.mjs`（把插件复制进去跑假 ctx，14 个工具）、换气 `node tools/mind-breathe-test.mjs`。
- 重启标记 `[dafeiyu-mind] tools ready`；重启用 `bash tools/restart-check-life.sh [秒]`。

## 表情包（meme 子系统）

- 图库在 `大肥鱼小窝/02资料库/表情包/`：`索引.json` 是插件唯一读的清单，`手工归类.json` 是人工覆盖，`收自主人/` 存机器人从聊天里收的图，`使用记录.jsonl` 记发送历史。分类说明见同目录 `分类说明.md`。
- 分类体系只有一份定义：`tools/meme-taxonomy.mjs` 的 `TAXONOMY`（18 个中文类，每类 kind/desc/use/avoid/kw/near）和 `SLUG_MAP`；插件（`plugins/dsh-dafeiyu-vault/lib/meme-ranking.js`）和索引导出器 `tools/meme-reindex.mjs` 都从这里取。
- 改分类或加图后：`node tools/meme-reindex.mjs` 重建索引，`node tools/meme-search-test.mjs` 验收排序与轮换；插件侧检索逻辑是纯函数，可直接跑测试，不用起宿主。
- 检索规则：点名分类且有图 → 只在该类内排序；点名分类但没图 → 返回空并给相邻类建议，绝不跨类凑数。
- 打分（`lib/meme-ranking.js`）：类别命中 +12、关键词命中类别 +8、note 命中词 +3、tag 命中 +3、bge-m3 语义相似度加最多约 11；`pickBest` 取最高分同分随机，**不做时间窗轮换**，同一张可以重复用。
- 语义层：`语义向量.json` 由 `node tools/meme-embed.mjs` 生成（bge-m3，ollama 127.0.0.1:11434），插件里 `embedQuery` 超时 2.5s 就自动退化纯关键词；收录新图时插件会顺手补向量。
- 逐张标注：`视觉标注.json` 存看图写下的 note/tags/cat（合并脚本 `tools/meme-vision-merge.mjs`），有了它 `meme-reindex.mjs` 才会写出不重复的 note；索引里没有 note 就等于只能按类别模板匹配。
- 插件改动仍需同步到 `~/.dsh/profiles/web/plugins/dsh-dafeiyu-vault/` 并重启 DSH 才生效；冒烟测试可用 `/tmp/memetest/run.mjs` 的假 ctx 方式。

## 规则

- 动手前先读 `本机运行说明.md` 和对应源码；路径不确定就查，不要猜。
- 改 `~/.dsh`、人格、记忆库、桥接配置前备份到 `backups/before-<事由>-<时间>/`。
- 不删备份；不泄露 `.env`、`管理界面入口.txt`、OneBot 令牌、QQ 密码。
- 不擅自改默认模型、默认预设、QQ 白名单；不擅自停 QQ 服务。
- 报告写清：改了哪些文件、验证结果、怎么回滚（具体备份目录或文件）。

## 生活状态（life 子系统）

- 源码 `plugins/dsh-dafeiyu-life/`：`lib/engine.js` 是纯函数状态引擎（精力/心情/睡眠/余波的时间推演，可直接跑测试，不碰 IO），`lib/store.js` 用 node:sqlite 落盘到 `大肥鱼小窝/04工作区/生活/life.db`，`lib/index.js` 负责注入与三个工具。
- 注入点：`ctx.on('system-prompt/assemble')`，只对 `companion` 预设的会话 push 一段 `dafeiyu:life` section；文本里不带数值。
- `lib/agenda.js`：当天的日程/节目单（虚构剧集《雪夜列车》等，集数逐日推进）、`currentItem` 算此刻在做什么、`composeDream` 用昨天聊到的线索编梦；`lib/proactive.js` 主动消息候选与闸门。
- 注入两段：`dafeiyu:life`（身体状态）和 `dafeiyu:agenda`（今天在做什么、追剧进度、早上的梦），都只对 `companion` 预设。
- 工具注册照 `dafeiyu-qq-tools` 的 equip 模式（`agent/created` + 列出现有 agent）。
- 改完：`node --check lib/*.js`、`node tools/life-engine-test.mjs`、`node tools/life-agenda-test.mjs`、`node tools/life-proactive-test.mjs`，同步到 `~/.dsh/profiles/web/plugins/dsh-dafeiyu-life/`，重启 DSH；重启守卫 `tools/restart-check-life.sh` 会在起不来时自动回滚。

## 生图（image-studio + 本机 ComfyUI）

- 插件 `dsh-image-studio`（本地改动版，见其 `NOTICE.md`）多了一个 provider `comfyui-qwen`：`lib/providers-comfy.js` 直接调本机 ComfyUI（`127.0.0.1:8188`）跑 Qwen-Image 2.1，不需要 API key。
- ComfyUI 在 `~/ComfyUI`，conda env `comfy`，模型在 `~/ComfyUI/models/`；起停用 `bash tools/comfy-start.sh`（provider 发现离线会自己拉起）。
- 参考库 `~/.dsh/image-studio/library/`：已有「大肥鱼」人物条目（3 张参考图 + 外观/人设/情境穿搭）和三套服饰。加图=往条目目录里丢图片，改说明=改 `entry.json`。
- 图生图的输出比例跟参考图走，所以 `providers-comfy.js` 会先把参考图 cover 裁到目标比例；多张参考图走 `images.image_1..N`，不拼图。
- 自测 `node tools/image-comfy-test.mjs`（23 项）；端到端出图 30–40 秒/张。
