# 大肥鱼 · 一个跑在 DeepSeek Harness 上的 QQ 陪伴机器人

大肥鱼是一只深蓝渐变的鲸鱼小女仆：傲娇、嘴硬心软，住在电脑里，通过 QQ 陪人聊天。
她不是"接个模型 API 回消息"的壳子——她有自己的心情、日程、日记、记忆、表情包库，
会自己排一天的安排、半夜饿了翻冰箱、看到好视频分享给你，也能读写文件、跑命令、装插件、生成图片。

项目形态：**一套 DeepSeek Harness（DSH）插件 + 人格设定 + 部署脚本**。
宿主是 [DeepSeek Harness](https://github.com/deepseek-ai)，本项目提供的是"她"这一层。

---

## 能力一览

| 模块 | 做什么 | 实现 |
| --- | --- | --- |
| 人格 | 18KB 人设稿，傲娇内核 / 情绪档位 / 台词汇编 / 边界 | `~/.dsh/companion/persona/persona.md` |
| 心智层 | 精力、心情、日程、梦、记事、未结事项，四段注入每轮提示词 | `plugins/dsh-dafeiyu-mind` |
| 记忆 | 长期记忆 + 召回 + 半衰期衰减 + 隐私边界 | `dsh-companion-core`（打补丁） |
| 表情包 | 521 张、逐张视觉标注 + 语义向量检索、按情绪挑图、去重 | `plugins/dsh-dafeiyu-vault` |
| 文件小窝 | 收件箱 / 资料库 / 任务输出 / 工作区 / 临时 / 归档 | 同上 |
| QQ 桥接 | OneBot 收发、长消息分段、进度心跳、超时兜底 | `dsh-napcat-bridge`（打补丁） |
| 生图 | 本机 ComfyUI + Qwen-Image，双画风（生活图 / 表情贴纸） | `plugins/dsh-image-studio`（fork） |
| 管理员能力 | `admin_sh` / `admin_sudo`，仅主人可用，自动纠正会话权限 | `plugins/dsh-dafeiyu-qq-tools` |
| 插件开关 | 运行时启停插件，省提示词 | `plugins/dsh-dafeiyu-plugins` |
| 开发模式 | 一套专门改这个项目的预设 + 技能 | `dev-preset/`、`dev-skills/` |

---

## 架构

```
QQ ←→ NapCat ←→ OneBot ←→ dsh-napcat-bridge ─┐
                                              ├─→ DSH profile "web"（Host + Client）
浏览器 ←──────────────────────────────────────┘      ├── companion-core（人格/记忆/召回）
                                                      ├── dafeiyu-mind（心智层，每轮注入）
                                                      ├── dafeiyu-vault（表情包/小窝文件）
                                                      ├── dafeiyu-qq-tools（管理员工具）
                                                      ├── image-studio（生图）
                                                      └── 其它插件…
```

* 宿主：DSH `0.2.1-rc.3`，profile 名 `web`，Web GUI 默认 `127.0.0.1:3080`。
* 插件都装在 profile 的 `plugins/` 下，`node_modules/<name>` 软链过去——**这样插件源码可直接改、改完即生效**，不会被 npm 重装覆盖。

---

## 目录结构

```
plugins/            自研与改造过的插件（每个是一份 DSH 插件包）
  dsh-dafeiyu-mind/       心智层：精力/心情/日程/梦/记事/读稿/未结
  dsh-dafeiyu-vault/      小窝文件 + 表情包库与检索
  dsh-dafeiyu-qq-tools/   管理员 shell 工具 + 会话权限纠正
  dsh-dafeiyu-plugins/    运行时插件开关
  dsh-dafeiyu-life/       旧版"生活"插件（已被 mind 取代，留作参考）
  dsh-dafeiyu-runtime/    运行时杂项
  dsh-remember-you/       记忆管理界面
  dsh-image-studio/       生图（fork v0.5.0，加本机 ComfyUI provider）
profile/            DSH profile 的 package.json（声明启用哪些 bundle）
dev-preset/         开发模式预设（专门改这个项目用）
dev-skills/         开发模式技能卡
app/                Docker 镜像内的装配脚本（init / check / 补丁）
lib/                shell 公共函数
tools/              各种运维与测试脚本（重启、迁移、表情重标、质检）
vendor/             打补丁的第三方插件 tgz（companion-core / napcat-bridge）
docs/               运行说明、安装验收、自定义设定说明
compose.yaml        Docker 部署
Dockerfile
install.sh          容器方案安装脚本
start.sh / stop.sh / status.sh / logs.sh / start-qq.sh   原生方案的启停
```

---

## 依赖

* Ubuntu（或其它能跑 DSH 的 Linux），Node.js 22+，Python 3.10+
* DSH `0.2.1-rc.3`（`npm i -g @deepseek-ai/dsh` 或容器内自带）
* NapCat / SnowLuma（QQ 协议端）+ OneBot 11 反向 WS
* 可选：ComfyUI + Qwen-Image（生图）、yutto/yt-dlp + ffmpeg（看她真去看 B 站视频）
* 可选：`bge-m3` 或其他本地 embedding（表情包语义检索；没有就退关键词）

---

## 安装（原生方案，推荐）

```bash
git clone <this-repo> ~/dafeiyu-linux
cd ~/dafeiyu-linux
bash tools/repack-paths.sh                 # 把仓库里的 /home/example 改成本机 $HOME
cp .env.example .env && vi .env            # 填 OWNER_QQ / BOT_QQ / 模型 key
# 把 plugins/*/cordis.patch.yml 里的 OWNER_QQ 换成你自己的 QQ 号
bash install.sh --native                   # 装依赖、软链插件、生成 profile 补丁
dsh --profile web                          # 起宿主
bash start-qq.sh                           # 起 QQ 协议端
```

Web GUI 打开 `http://127.0.0.1:3080`，登录链接在启动日志里（`grep token ~/.local/state/deepseek-harness/server.log`）。

## 安装（Docker 方案）

```bash
cp .env.example .env && vi .env
docker compose up -d --build
```

容器方案把 DSH、NapCat、SnowLuma 一起装进镜像；**插件同样在 `plugins/` 里，改完重启容器生效**。

---

## 配置

| 位置 | 内容 |
| --- | --- |
| `.env` | `OWNER_QQ`（主人）、`BOT_QQ`（机器人）、OneBot token、模型 key、端口 |
| `~/.dsh/companion/persona/persona.md` | 人格稿，每轮读取，改完即生效 |
| `~/.dsh/profiles/web/cordis.patch.yml` | profile 层插件装配（**新增插件必须用 `- insert:`**，仅覆盖已有行会静默失效） |
| `大肥鱼小窝/`（vault） | 她的文件小窝：`01收件箱` `02资料库` `03任务输出` `04工作区` `05临时` `06归档` |
| `~/.dsh/image-studio/` | 生图参考库（人物 / 服饰 / 场景 / 道具）与配置 |

**必改的两处占位符**：仓库里所有 `OWNER_QQ` / `BOT_QQ` 都是你自己的 QQ 号与机器人号；
`docs/` 与 `plugins/*/cordis.patch.yml` 里都有，全局替换即可。

---

## 常用命令

```bash
bash start.sh            # 起宿主
bash start-qq.sh         # 起 QQ 端
bash status.sh           # 看状态
bash logs.sh dsh         # 日志
bash stop.sh             # 停宿主（QQ 端继续跑）

bash tools/restart-check-life.sh 20   # 安全重启：脱离当前会话重启 + 健康检查 + 失败回滚
bash tools/mind-migrate.mjs           # 心智层数据库迁移
bash tools/meme-reindex.mjs           # 表情包重建索引
bash tools/mind-door-audit.mjs        # 记忆"门牌"巡检（会话没了就清空来源）
```

> ⚠️ **不要直接 `systemctl restart`**：热重启会让宿主进入崩溃循环（踩过，45 分钟）。
> 统一走 `tools/restart-check-life.sh`，它会在独立 systemd 作用域里重启并等 `[dafeiyu-*] tools ready`。

---

## 设计上踩过的坑（写给后来的人）

1. **QQ 会话 id 是固定的**（`napcat-napcat-FriendMessage-<qq>`）。一旦进了 `~/.dsh/storages/workspace.json` 的 `global.archivedSessionIds`，DSH 的归档闸门会每步 reject，模型一次都调用不到，表现是"她不回复"。清理会话时**不要归档它**。
2. **profile 层补丁只能覆盖已有行**，新增必须 `- insert: [{id, name}]`，否则报 `patch: entry "x" not found` 且静默无效。
3. **第三方插件要复制进 `plugins/` 再软链**，否则 npm 重装会冲掉你打的补丁。
4. **QQ 端的审批框没人点**，所以管理员工具那层会把会话权限自纠正成 `danger-full-access` + `never`；否则每条命令都卡在弹窗上。

---

## 许可

代码部分 MIT（见 `LICENSE`）。人格文本与表情包素材版权归原作者，仅供个人使用，**请勿用于商业分发**。
第三方插件（companion-core / napcat-bridge / image-studio 等）遵循它们各自的许可证。
