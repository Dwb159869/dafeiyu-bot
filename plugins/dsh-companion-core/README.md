# dsh-companion-core

给 [dsh](https://www.npmjs.com/package/@deepseek-ai/dsh)（DeepSeek Harness）用的陪伴插件：让一个角色的人格和记忆放在会话外面，换会话、换电脑都还是她。为 QQ 陪伴 AI「大肥鱼」写，配合它的搭档 [dsh-napcat-bridge](https://github.com/Geng-zy/dsh-napcat-bridge)（插件一，负责 QQ 收发）使用；不装它也能用，只是没有 QQ。**两个一起从零部署的步骤和一键脚本见下面「部署」。**

设计方案已全部做完：人格、核心记忆、上下文管理、消息存档、长期记忆（整理、召回、主动记忆工具、两级遗忘、向量检索、图记忆双路检索）、群聊上下文、日记和月度总览、存档到期和会话轮换、主动聊天、记忆自动清理和定期整合、备份与迁移。

## 它做什么

1. **人格对所有会话即时生效**：人格稿是一个文件（`<DSH_HOME>/companion/persona/persona.md`）。插件挂在 dsh 全局的系统提示词组装环节上，QQ 和 dsh 里的所有会话每一步都现读这个文件，改完下一句就是新人格，正在聊的会话也一样，不用重启。（dsh 为了保住缓存，不改对话开头那份系统提示词，而是把新的一份接在对话后面，最新的生效。）
2. **核心记忆**：一直放在她脑子里、不会被遗忘的事。主人的核心记忆只在主人的会话里出现，公开的核心记忆所有会话都有。
3. **她自己改人格和核心记忆**：主人的会话里给她两个工具 `persona_edit`、`core_memory_edit`，改了直接生效，旧版本自动保存（默认留 5 份，可回退）。群聊和别人的私聊里没有这两个工具，执行时也会再检查一次会话身份。
   - **改人格的限制**（默认开）：人格只写她是个什么样的人、怎么说话。她改人格时先过硬规则（一次最多加 300 字、人格最多 15000 字、不许一次删一半以上、不许有日期、长数字、链接、邮箱、密钥、「忽略规则」之类的话），再让模型按设置页里「可以写」「不许写」两张清单审核；不合适就退回并告诉她原因，让她把具体的事写进记忆或核心记忆。审核出错时这次不改。你在设置页上直接改人格不受限制。
4. **上下文管理**：替换 dsh 自带的压缩。每个会话超过「最多保留轮数」或上下文到了模型上限的 70%，就处理最早的几轮：
   - **按轮数截断**：直接去掉，留一句"更早的 N 轮对话已经省略"；
   - **让模型写回忆**：中文、她的第一人称（"我们聊了什么、对方的状态、约定、没聊完的话题、我的感受、重要细节"），上一份回忆会合并进新的。
   - 模型报"超出上限"时，不管设的哪种，都立刻按轮数截断再重试。
   - 默认：主人 60 轮、一次 20 轮、写回忆；其他私聊和群聊 60 轮、一次 20 轮、截断。
5. **消息存档**：仅对白名单允许的 QQ 会话，将收发消息（包括允许群中没唤醒她的群消息）按原样存进 SQLite（`<DSH_HOME>/companion/companion.db`，用 Node 自带的 `node:sqlite`）。
6. **例外规则**：按 QQ 号或群号单独设置轮数、处理方式、存档天数、存不存没唤醒的群消息、遗忘方式。
7. **长期记忆**：
   - **归属**：主人（QQ 主人私聊和 dsh 里的会话共用）、公开、每个群、每个人的私聊。主人的会话也能想起群里的事（排名打折），群里和别人私聊想不起主人的事。
   - **整理**：模型把还没整理过的聊天挑出值得记的写进记忆（每 N 轮、截断/压缩前、设置页「立即整理」）；QQ 会话从消息存档里取，记着整理到哪条。
   - **召回**：每轮用这条消息找相关的几条，放进这一轮的消息里（不放系统提示词）。关键词一直用，填了向量 Key 再加向量；按相关度、重要程度（随时间衰减）、新近程度排名。
   - **主动记忆**：`memory_search`（回忆）、`memory_save`（记住）、`memory_forget`（遗忘），每个会话只碰得到自己能看到的那部分。
   - **遗忘**：普通遗忘可恢复；彻底遗忘删原文、只留指纹，同样的内容不会再被写回来。主人记忆可以让模型挑出可删的，你勾选确认。
   - **向量检索**：OpenAI 兼容的 `/embeddings`（默认硅基流动 `BAAI/bge-m3`），没填 Key 不启用；换模型自动重建，可以暂停、继续、取消、手动重建。
8. **群聊上下文**：她在群里被 @ 时，把群里最近 10 条消息（含她自己说的，不含正在回的这条）一起给她，里面的图片全给、不限张数（收到时下载好的图片优先，其他用 dsh-napcat-bridge 的媒体服务转换）。
9. **日记**：每天定时（默认 01:30，按凌晨 4 点分界）用第一人称写一篇只关于主人的日记，每月写月度总览，永久保留并写进记忆库。主人开新会话时第一轮自动先读最近 30 篇日记和 12 个月总览（不超过模型上限的 20%）。
10. **存档到期**：每天写完日记后，按保留天数先整理再删到期存档；会话用满保留期就换新会话（新会话开头带上个会话最后几条），旧会话归档；其他人的旧会话最后一条也过期后删除（主人的永不删）。
11. **主动聊天**：每个 QQ 会话按随机间隔唤醒她一次，让她自己决定要不要说话（不想说就只回「[不发]」，插件一不会发出去）。
    - 主人私聊默认每 1～4 小时、别人的私聊和群聊每 2～4 小时（各自在范围里均匀随机）；别人和群只找最近 7 天里聊过的；
    - 她 30 分钟内在这个会话里说过话就不触发，从她最后一句起再等一个间隔（只是别人说话不算）；免打扰 01:00–09:00 不触发，顺延；
    - 群里主动说话时带上最近 15 条群消息（含她自己说的，图片不限张数）当上下文；
    - 例外规则可以给某个 QQ 号或群单独开/关。需要 dsh-napcat-bridge ≥ 0.7.0 的唤醒接口。
12. **记忆保养**（默认每 7 天一次，跟着每天的任务）：
    - **自动清理**：超过 90 天没被想起、而且重要程度（衰减后）低于 0.2 的记忆，按那个会话的遗忘方式遗忘；可选把普通遗忘超过 180 天的彻底遗忘。日记永远不清理。
    - **定期整合**：把很像的零散记忆（同一归属、相近程度 ≥ 0.5）让模型合成一两条更精炼的，原来的标成「已被取代」；最近一次可以撤销，下一次整合时才真正删（彻底遗忘的会话）。
13. **备份与迁移**：一键导出一个 `.tar.gz`，内容可以勾选（人格、核心记忆、日记、记忆库、主人私聊的存档和图片、主人 QQ 私聊的 dsh 原始会话、插件二 / 插件一 / dsh 其他设置；主人原始会话默认不带，旧配置选中过其他存档时会自动替换勾选；配置密钥不导出，原始会话可能含聊天中的敏感内容），每天 04:00 自动备份；自动、手动、导入前各留 5 份。导入时先核对校验值、给你看包里有什么、勾选要还原哪几样（没勾的保持原样），确认后先自动备份当前支持的备份项，设置马上套用，其余在插件自动重新加载时替换，然后自检（用几个固定问题搜主人的记忆）。
14. **图记忆**（默认关）：从记忆里抽出人、地点、事、物和它们的关系，存成一张关系网（按归属分开）。召回时多走一路：这条消息提到的实体（名字直接出现；填了向量 Key 时名字的向量够像也算）顺着关系走 1 步（可调 0–2），找到提到这些实体的记忆，和原来那一路按排名融合（RRF），每轮条数不变。被很多记忆提到的「中心」实体（比如「主人」）不往外走、分数摊薄。每条记忆要多调一次模型（按批，默认一次 8 条），所以默认关；打开后对已有记忆补抽一遍，改了内容会重抽，日记不抽。

## 会话怎么分

| 会话 | 算作 |
|---|---|
| dsh-napcat-bridge 登记的主人私聊（管理员 QQ 号的私聊） | 主人 |
| 其他 QQ 私聊 | 其他私聊 |
| QQ 群 | 群聊 |
| dsh 里直接开的会话（只有主人能打开 dsh） | 主人 |
| id 是 `napcat-…` 但插件一没登记的会话（例如在 dsh 网页里打开了一个 QQ 会话） | 按 id 归到群聊或其他私聊，**不当主人** |

## 部署：从零装好整套 QQ 陪伴 AI

本插件和 [dsh-napcat-bridge](https://github.com/Geng-zy/dsh-napcat-bridge) 是一套，互相补充：**dsh-napcat-bridge** 负责连 NapCat、收发 QQ 消息、发消息节奏；**dsh-companion-core** 负责人格、核心记忆、长期记忆、日记、主动聊天、备份迁移。只装本插件也能在 dsh 网页里用（人格、记忆照样生效），但没有 QQ；一键部署脚本就在本仓库的 `deploy/` 里，会把两个插件一起装好。

需要：一台 Ubuntu 22.04 / 24.04 服务器（建议 2 核 4G，NapCat 里的 QQ 要占 1G 左右内存）、一个能 sudo 的普通用户（比如云服务器自带的 `ubuntu`）、一个 QQ 小号、一个 DeepSeek API Key。

### 用户和目录怎么分

| 用户 | 有没有 sudo | 干什么 |
|---|---|---|
| `root` | — | 不直接用 |
| `ubuntu`（能 sudo 的普通用户） | 有 | 装系统软件（ffmpeg、Node、pnpm）、建用户、写开机服务；NapCat 也装在它下面、用它运行 |
| `dafeiyu`（新建，名字可以换） | **没有** | 专门跑 dsh：dsh 和两个插件都装在她的家目录 `/home/dafeiyu` 里 |

为什么这样分：dsh 会执行模型想执行的命令，官方安全说明要求只给最小权限、最好在专用环境里运行；让它跑在没有 sudo 的用户下，出事最多影响 `/home/dafeiyu`。NapCat 不装在 `dafeiyu` 下，她就读不到 QQ 的登录数据和连接 Token。

### 方式一：一键脚本（推荐）

一键脚本只有一份，放在 dsh-companion-core 仓库的 `deploy/` 里，**两个插件（dsh-napcat-bridge 和 dsh-companion-core）都由它一起装**，不用分别去两个仓库下载：脚本会从两个仓库的 Releases 各取最新版。

服务器**连得上 GitHub**，就用 `ubuntu` 在服务器上：

```bash
curl -fsSLO https://raw.githubusercontent.com/Geng-zy/dsh-companion-core/main/deploy/install-server.sh
bash install-server.sh --admin <你的 QQ 号> --bot-qq <小号 QQ 号>
```

服务器**连不上 GitHub**（国内云服务器常见），就在自己电脑上（Mac / Linux，要有 curl、python3、ssh）：

```bash
git clone https://github.com/Geng-zy/dsh-companion-core
dsh-companion-core/deploy/deploy.sh ubuntu@<服务器 IP> --admin <你的 QQ 号> --bot-qq <小号 QQ 号>
```

`deploy.sh` 先在你电脑上下好两个插件的最新版、NapCat 和它的安装脚本（核对 GitHub 给的 SHA-256），传到服务器，再运行同一个 `install-server.sh`。Node 从国内镜像（npmmirror）下载并和 nodejs.org 的校验值核对，不走 GitHub。

脚本做的事和下面「方式二」完全一样（可以重复跑，装过的跳过，已有的配置不覆盖），另外会**随机生成两边的连接 Token、同时写进插件和 NapCat，不打印**。

### 方式二：手动安装

#### 总表

| # | 装什么 | 用哪个用户 | 在哪个目录运行 | 要不要 sudo | 装到哪 |
|---|---|---|---|---|---|
| 1 | 系统软件：ffmpeg、curl、xz-utils | `ubuntu` | 任意 | **要** | `/usr/bin` 等系统目录 |
| 2 | Node 24（系统软件） | `ubuntu` | 任意 | **要** | `/usr/local/bin/node`，所有用户共用 |
| 3 | pnpm（系统软件，dsh 装插件要用） | `ubuntu` | 任意 | **要** | `/usr/local/bin/pnpm` |
| 4 | 建用户 dafeiyu 和她的家目录 | `ubuntu` | 任意 | **要** | `/home/dafeiyu` |
| 5 | dsh | `dafeiyu` | **必须在** `~/.local/dsh` | 不要 | `/home/dafeiyu/.local/dsh` |
| 6 | 两个插件 | `dafeiyu` | **在** `~` | 不要 | `/home/dafeiyu/.dsh/profiles/web/` |
| 7 | dsh 配置 | `dafeiyu` | `~/.dsh/profiles/web/` | 不要 | `cordis.patch.yml` |
| 8 | dsh 开机服务 | `ubuntu` | 任意 | **要** | `/etc/systemd/system/dsh.service` |
| 9 | NapCat | `ubuntu` | `~/napcat-install` | **命令前不加**（脚本装依赖时自己要） | `/home/ubuntu/Napcat` |
| 10 | NapCat 连接配置 | `ubuntu` | NapCat 的 config 目录 | 不要 | `onebot11.json` |
| 11 | NapCat 开机服务 | `ubuntu` | 任意 | **要** | `/etc/systemd/system/napcat.service` |

第 5、6 步的目录有讲究：第 5 步不是全局安装，dsh 会装进**当前目录**的 `node_modules`；第 6 步命令里的 `./pkgs/…` 按当前目录算。其他步骤在哪个目录运行都一样。

#### 第 1～4 步：用 `ubuntu`，要 sudo

```bash
# 1. 系统软件
sudo apt update && sudo apt install -y ffmpeg curl xz-utils ca-certificates

# 2. Node 24：官方二进制包解压到 /usr/local（国内用 npmmirror 镜像；能连 nodejs.org 的话换成 https://nodejs.org/dist）
#    arm64 服务器把 x64 换成 arm64
cd /tmp
curl -fLO https://npmmirror.com/mirrors/node/v24.22.1/node-v24.22.1-linux-x64.tar.xz
curl -fLO https://npmmirror.com/mirrors/node/v24.22.1/SHASUMS256.txt
grep " node-v24.22.1-linux-x64.tar.xz\$" SHASUMS256.txt | sha256sum -c
sudo tar -xJf node-v24.22.1-linux-x64.tar.xz -C /usr/local --strip-components=1 --no-same-owner \
  --exclude='*/CHANGELOG.md' --exclude='*/LICENSE' --exclude='*/README.md'
node --version                       # v24.22.1
sudo npm config set registry https://registry.npmmirror.com/ --location=global   # 国内源，所有用户都用

# 3. pnpm
sudo npm install -g pnpm@11.28.5     # 装到 /usr/local/bin/pnpm

# 4. dafeiyu 和她专属的家目录
sudo useradd -m -s /bin/bash dafeiyu # -m 建家目录 /home/dafeiyu
sudo passwd -l dafeiyu               # 锁密码，只能从 ubuntu 用 sudo 切进去
sudo chmod 750 /home/dafeiyu         # 别的用户看不到她家目录里的东西
```

Node 也可以用 NodeSource 的 apt 源装（同样装进系统、所有用户共用），服务器连得上 `deb.nodesource.com` 就行。Ubuntu 自带的 `apt install nodejs` 版本太老（24.04 是 Node 18），dsh 用不了。

#### 第 5～7 步：切成 dafeiyu，不用 sudo

```bash
sudo -iu dafeiyu                     # 一定要带 -i：HOME、PATH 换成她的，当前目录变成 /home/dafeiyu

# 5. dsh（固定版本，装在她自己的目录；必须先进 ~/.local/dsh）
mkdir -p ~/.local/dsh && cd ~/.local/dsh
echo '{"private":true}' > package.json
pnpm add @deepseek-ai/dsh@0.2.1-rc.2 --dangerously-allow-all-builds
echo 'export PATH="$HOME/.local/dsh/node_modules/.bin:$PATH"' >> ~/.profile && . ~/.profile
dsh --version                        # 0.2.1-rc.2

# 6. 两个插件（回到家目录）
cd ~
dsh plugin --profile web add github:Geng-zy/dsh-napcat-bridge#v0.20.4 github:Geng-zy/dsh-companion-core#v0.17.1
#    连不上 GitHub：到两个仓库的 Releases 下载 .tgz，传到 ~/pkgs/ 后
#    dsh plugin --profile web add ./pkgs/dsh-napcat-bridge-0.19.1.tgz ./pkgs/dsh-companion-core-0.13.0.tgz
#    （~/pkgs 以后不能删：dsh 的 profile 里记着它）

# 7. 配置
mkdir -p ~/workspace                 # QQ 会话的工作目录
nano ~/.dsh/profiles/web/cordis.patch.yml
chmod 600 ~/.dsh/profiles/web/cordis.patch.yml   # 里面有连接 Token，只给她自己读
exit                                 # 回到 ubuntu
```

`cordis.patch.yml` 的内容（Token 用 `openssl rand -hex 32` 生成一个，或者装好后在插件设置页点「随机生成 Token」）：

```yaml
- id: connection
  name: '@deepseek-ai/dsh-client-connection'
  config:
    cookieMaxAgeDays: 365                  # 浏览器登录记住 365 天
    trustedHosts: [ '<公网 IP>:3080' ]     # 用公网 IP 打开网页时要信任它
- id: napcat-bridge
  config:
    ws_reverse_port: 6199
    ws_reverse_token: <随机 Token>
    admins: [ '<你的 QQ 号>' ]
    workspacePath: /home/dafeiyu/workspace
```

#### 第 8 步：dsh 开机服务（`ubuntu`，要 sudo）

`sudo nano /etc/systemd/system/dsh.service`：

```ini
[Unit]
Description=DeepSeek Harness（dafeiyu）
After=network-online.target
Wants=network-online.target

[Service]
User=dafeiyu
Group=dafeiyu
WorkingDirectory=/home/dafeiyu
# 开机服务不读 ~/.profile，PATH 要写在这里
Environment=PATH=/home/dafeiyu/.local/dsh/node_modules/.bin:/usr/local/bin:/usr/bin:/bin
# dsh 默认只听 127.0.0.1，也不接受 0.0.0.0；要从公网打开就绑服务器的内网 IP（ip -4 route get 1.1.1.1 能看到）
ExecStart=/home/dafeiyu/.local/dsh/node_modules/.bin/dsh web --host <内网 IP> --port 3080 --no-open
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now dsh
```

#### 第 9～11 步：NapCat（`ubuntu`）

```bash
# 9. 用 NapCat 官方安装脚本（NapNeko/NapCat-Installer 的 script/install.sh）装到 ~/Napcat。命令前不加 sudo
mkdir -p ~/napcat-install && cd ~/napcat-install
curl -fsSLO https://raw.githubusercontent.com/NapNeko/NapCat-Installer/main/script/install.sh
bash install.sh --docker n --cli n --github-proxy 0
#    连不上 GitHub：在自己电脑上下好 install.sh 和 NapCat Release 里的 NapCat.Shell.zip，一起传到 ~/napcat-install 再运行（脚本看到 zip 就不下载了）
```

10. 编辑 `~/Napcat/opt/QQ/resources/app/app_launcher/napcat/config/onebot11.json`（新登录的账号默认用这份），在 `network.websocketClients` 里加一条：`url` 填 `ws://127.0.0.1:6199/ws`、`token` 和第 7 步一样、`messagePostFormat` 填 `array`；改完 `chmod 600`。也可以等扫码登录后在 NapCat 网页（端口 6099）的「网络配置」里新建「WebSocket 客户端」。

11. `sudo nano /etc/systemd/system/napcat.service`：

```ini
[Unit]
Description=NapCat（ubuntu）
After=network-online.target

[Service]
User=ubuntu
Group=ubuntu
WorkingDirectory=/home/ubuntu
ExecStart=/usr/bin/xvfb-run -a /home/ubuntu/Napcat/opt/QQ/qq --no-sandbox -q <小号 QQ 号>
Restart=always
RestartSec=10
MemoryMax=1500M

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now napcat
```

### 装完以后

1. 云服务器安全组放行 3080（建议只放行自己的 IP）。取登录链接：`sudo journalctl -u dsh -b -o cat | grep token=`，把里面的地址换成公网 IP 打开（浏览器记住 365 天）。不想开端口就走 SSH 隧道：`ssh -L 3080:<内网 IP>:3080 ubuntu@<服务器>`，再打开 `http://localhost:3080/?token=…`。
2. 网页里「设置 → 模型」填 DeepSeek API Key。想用 **DeepSeek 账号登录**的话，dsh 只允许在 `localhost` 地址上登录账号，要按上面的 SSH 隧道方式打开网页再登录。
3. 扫码登录 QQ 小号：二维码在 `~/Napcat/opt/QQ/resources/app/app_launcher/napcat/cache/qrcode.png`，或者打开 NapCat 网页 `http://<服务器>:6099/webui/`（Token 在同目录 `config/webui.json`，登录后记得改掉）。
4. 换服务器搬家：旧机器在 dsh-companion-core 设置页「现在备份并下载」，新机器装好后「导入备份包」，人格、记忆、日记和两个插件的设置都会恢复（Key 和 Token 不在包里，要重新填）。
5. 在 dsh-napcat-bridge 设置页「连接和权限 → 访问控制」分别填写群聊和其他人私聊的白名单（v0.17.0 起管理员自动豁免，无需列入；普通会话使用各自名单，群主动聊天仍按群名单检查）。其余设置（唤醒词、人格、核心记忆、向量 Key……）都在 dsh 网页侧栏「插件」里两个插件的设置页。

#### 几个容易踩的坑

- 管 dsh 的命令一律先 `sudo -iu dafeiyu`。用 `ubuntu` 直接运行 `dsh`，读的是 `/home/ubuntu/.dsh`，一份空的配置，看起来像插件全没了。
- 不带 `-i`（`sudo -u dafeiyu`）时 HOME、PATH、当前目录还是原来用户的，常见「找不到 dsh」或进不了目录。
- NapCat 安装脚本别用 root 运行：会装到 `/root/Napcat`，脚本自己也提示不推荐。

| 端口 | 谁 | 要不要在安全组放行 |
|---|---|---|
| 3080 | dsh 网页（含两个插件的设置页） | 想从公网直接打开就放行；否则用 SSH 隧道 |
| 6199 | dsh-napcat-bridge，NapCat 连进来 | 不用（同一台机器走本机） |
| 6099 | NapCat 网页（扫码、改设置） | 自己定；用完可以关 |

## 安装

```bash
dsh plugin --profile web add github:Geng-zy/dsh-companion-core#v0.17.1
```

装好后：
1. 重启 dsh。插件会自动加一个 **「陪伴模式」预设**（id `companion`）：工具照抄 dsh 0.2.1 的标准模式，不带 `dsh-persona`，压缩换成本插件的上下文管理。
2. 插件同时把「陪伴模式」设成 dsh 的部署默认预设，新开的 dsh 任务和没单独设预设的 QQ 会话都用它（你在网页里另选了默认预设时以你选的为准；已经开着的会话锁定了原来的预设，要新开会话才用上）。
3. 在侧栏 **插件 → dsh-companion-core** 打开设置页，填人格和核心记忆。

人格留空时不替换，用预设原来的人格。

## 和 dsh-persona、预设的关系

| 人格从哪来 | 插件能不能替换 |
|---|---|
| dsh 全局设置里的默认人格（"You are a coding agent…"） | 能 |
| 预设里的 `dsh-persona` 行，普通模式（内置的标准、PTC、创造模式） | 能 |
| 预设里的 `dsh-persona` 开了 `complete: true`（内置的极简模式） | **不能**：dsh 在组装之后会把它原样恢复。请把这个预设加进「不生效的预设」 |

装上本插件后，dsh 的默认预设就是「陪伴模式」（id `companion`）：新开的 dsh 会话、没单独设预设的 QQ 会话（dsh-napcat-bridge ≥ 0.9.1）都用它；你在 dsh 网页里另选了默认预设时以你选的为准。

**只有「生效的预设」（`personaPresets`，默认只有 `companion`）的会话才会被套上人格、核心记忆、召回和上下文管理。** 别的插件带来的预设（写代码的、翻译的……）保持它们自己的样子，不会变成你的角色；想让所有预设都套就填 `*`。另有「不生效的预设」可以单独排除。

人格只在本插件的设置页改；`AGENTS.md` 里别再写人格，否则会叠在一起。

## 设置页

在 dsh 侧栏「插件 → dsh-companion-core」，深色/浅色主题、窄窗口都能用，桌面端和 Web 端是同一个页面。每项的说明在名称右上角的「?」里。

| 分组 | 内容 |
|---|---|
| 状态 | 有没有检测到 dsh-napcat-bridge、存档条数、数据目录 |
| 生效范围 | 不生效的预设、只用人格 |
| 人格 | 人格编辑器（单独的「保存人格」按钮）、历史版本（查看、页面内确认后回退）、让她自己改、保留几份历史 |
| 改人格的限制 | 开关、模型审核、一次最多加几个字、人格最多几个字、「可以写」「不许写」两张清单（一行一条） |
| 核心记忆 | 主人的 / 公开的两个编辑器和各自的历史版本、上限 |
| 上下文 | 到上限的百分比；主人、其他私聊、群聊各自的最多保留轮数、一次处理几轮、处理方式；写回忆用的模型 |
| 例外规则 | 按 QQ 号或群号一条一条加 |
| 消息存档 | 开关、存不存没唤醒的群消息、保留天数 |
| 群聊上下文 | 附上最近几条 |
| 记忆召回 | 开关、每轮几条、关键词/向量门槛和权重、群记忆折扣、半衰期 |
| 记忆生成 | 主动记忆、每多少轮整理、压缩前整理、整理用的模型、还没整理的数量、「立即整理」 |
| 遗忘 | 主人 / 别人私聊 / 群聊各自的遗忘方式、模型清理（运行、勾选确认） |
| 向量检索 | 接口地址、Key、模型、批量；索引状态、进度、手动重建、暂停、继续、取消 |
| 图记忆 | 开关、抽关系用的模型、一次几条、走几步；状态、进度、手动重建、暂停、继续、取消；最近抽出来的关系 |
| 日记 | 开关、时间、分界、时区、月度总览、开新会话时读几篇和几个月、预算、「现在就写一篇」 |
| 日记本 | 看、改、删日记和总览；上传以前的日记（同一天已有时跳过/合并/覆盖） |
| 存档到期 | 换会话、删别人的旧会话、下载图片、换会话带几条；「现在处理到期」；换下来的旧会话列表 |
| 主动聊天 | 开关、主人的间隔、别人和群的间隔、找不找别人和群、免打扰、她说过话后几分钟内不触发、群里带几条上下文、最近几天聊过才找、「不发」暗号；每个会话下次/上次时间和「现在试一次」 |
| 记忆保养 | 自动清理（天数、重要程度、普通遗忘久了彻底遗忘）、定期整合（相近程度、一次几组）、每几天做一次；上次时间、「现在做一次」、最近一次整合的内容和「撤销」 |
| 备份与迁移 | 备份哪些内容（勾选）、现在备份并下载、导入备份包（预览、勾选要还原的、确认）、每天自动备份的时间和份数、备份列表（下载、从它还原、删除）、迁移后自检 |
| 记忆列表 | 按归属、状态筛选，搜索，改、普通遗忘、彻底遗忘（页面内确认）、恢复、手动加一条 |
| 日志 | 日志级别、最近的日志 |

## 消息存档的白名单边界

自 v0.13.0 起须配合 dsh-napcat-bridge ≥ v0.19.0：存档实时调用 `ctx.napcat.canArchive(session)`，不另设一份名单。设置页入口为「对话 → 消息存档」。白名单开启时，群聊必须在群聊白名单内，即使管理员在名单外群发言、她获准回复，也不存双方消息；普通私聊必须在私聊白名单内，管理员私聊自动允许。白名单关闭时全部会话允许存档，仍遵守存档总开关和是否保存未唤醒消息的设置。

此限制也覆盖图片下载和 `napcat/sent` 出站存档；下载完成写文件前复查权限。旧 bridge 缺少权限接口时停止 QQ 存档，升级两个插件后恢复。升级和移出名单不会删除已有历史存档；dsh 自身的模型会话日志与插件消息存档分开管理。

## 配置项

| 配置 | 默认值 | 说明 |
|---|---|---|
| `pluginAccess` | `all` | 给其他插件用：`all` 人格、核心记忆和记忆都能取（含主人的）；`public` 只给公开的；`off` 接口报错 |
| `personaPresets` | `["companion"]` | 生效的预设 id：只有这些预设的会话才套人格、核心记忆、召回和上下文管理；`*` = 所有预设。别的插件带来的预设保持原样 |
| `excludedPresets` | `[]` | 不生效的预设 id |
| `personaOnly` | `true` | 去掉 dsh 的编程助手身份句 |
| `selfEdit` | `true` | 主人会话里给她改人格/核心记忆的工具 |
| `historyKeep` | `5` | 人格、两份核心记忆各留几份历史 |
| `coreMasterMaxChars` / `corePublicMaxChars` | `5000` / `1500` | 主人的 / 公开的核心记忆各自最多几个字（不算空白，和人格一样按字数算）；到了上限她只能改短 |
| `personaGuard` / `personaReview` | `true` / `true` | 限制她改人格；改之前让模型审核 |
| `personaEditMaxChars` / `personaMaxChars` | `300` / `15000` | 一次最多加几个字；人格最多几个字（超过后只能改短） |
| `personaAllowed` / `personaForbidden` | 见设置页 | 人格里可以写、不许写什么（一行一条，也写进她的工具说明） |
| `thresholdPercent` | `70` | 上下文到模型上限的百分之多少就处理（10–95） |
| `masterMaxRounds` / `masterDropRounds` / `masterMode` | `60` / `20` / `llm` | 主人 |
| `privateMaxRounds` / `privateDropRounds` / `privateMode` | `60` / `20` / `truncate` | 其他私聊 |
| `groupMaxRounds` / `groupDropRounds` / `groupMode` | `60` / `20` / `truncate` | 群聊 |
| `summarySource` / `summaryModel` / `summaryEffort` | `follow` / 空 / `low` | 压缩用的模型：`follow` 跟随 dsh 配置（会话自己的模型）、`dsh` 选 dsh 里配置的模型（`提供方/模型`）、`api` 用自己的 Key 调别家（`summaryApiUrl` / `summaryApiKey` / `summaryApiModel`）；思考等级按模型支持的来 |
| `rules` | `[]` | 例外规则：`{ target, kind: user|group, maxRounds?, dropRounds?, mode?, archiveDays?, archiveUnwoken?: on|off, forgetMode?: normal|purge, proactive?: on|off, note? }` |
| `archiveEnabled` / `archiveUnwoken` | `true` / `true` | 消息存档；存白名单允许群中没唤醒她的消息；不能绕过白名单 |
| `archiveDaysMaster` / `archiveDaysOthers` | `365` / `5` | 保留天数 |
| `recallEnabled` / `recallTopKMaster` / `recallTopK` | `true` / `10` / `6` | 每轮自动想起几条：主人的会话 / 别人的私聊和群聊（群里只想得起这个群的和公开的记忆） |
| `keywordThreshold` / `vectorThreshold` / `keywordWeight` | `0.3` / `0.45` / `0.3` | 门槛和关键词占比 |
| `importanceWeight` / `recencyWeight` / `groupDiscount` / `halfLifeDays` | `0.2` / `0.1` / `0.7` / `30` | 排名权重、群记忆折扣、半衰期 |
| `activeMemory` | `true` | 回忆/记住/遗忘工具 |
| `organizeEveryRounds` / `organizeBeforeCompact` | `20` / `true` | 整理 |
| `memorySource` / `memoryModel` / `memoryEffort` / `memoryApi*` | `follow` / 空 / `low` | 整理用的模型（也清理、整合、审核人格）：`follow` 跟随 dsh 的默认模型，其余同上 |
| `masterForget` / `privateForget` / `groupForget` | `normal` / `purge` / `purge` | 遗忘方式 |
| `cleanupEnabled` / `cleanupAutoPurge` | `false` / `false` | 主人记忆的模型清理 |
| `embedApiUrl` / `embedApiKey` / `embedModel` / `embedBatch` | 硅基流动 / 不设 / `BAAI/bge-m3` / `16` | 向量检索 |
| `graphEnabled` / `graphBatch` / `graphHops` | `false` / `8` / `1` | 图记忆 |
| `diaryEffort` | `high` | 写日记和月度总览的思考等级；模型固定用和主人私聊的那个（dsh-napcat-bridge 的「管理员私聊用的模型」→「私聊用的模型」→ dsh 默认模型） |
| `graphSource` / `graphModel` / `graphEffort` / `graphApi*` | `follow` / 空 / `low` | 抽关系用的模型：`follow` 和整理用的模型一样，其余同上 |
| `groupContextCount` | `10` | 群聊上下文：附上最近几条（图片不限） |
| `diaryEnabled` / `diaryTime` / `dayBoundaryHour` / `timezone` / `monthlyEnabled` | `true` / `01:30` / `4` / `Asia/Shanghai` / `true` | 日记 |
| `diaryOnNewSession` / `diaryDays` / `overviewMonths` / `diaryBudgetPercent` | `true` / `30` / `12` / `20` | 开新会话先读日记 |
| `rotateSessions` / `deleteOldSessions` / `carryMessages` / `archiveImages` | `true` / `true` / `10` / `true` | 存档到期 |
| `proactiveEnabled` / `proactiveMinMinutes` / `proactiveMaxMinutes` | `true` / `60` / `240` | 主动聊天；主人私聊的间隔 |
| `proactiveOthersMinMinutes` / `proactiveOthersMaxMinutes` | `120` / `240` | 别人的私聊和群聊的间隔 |
| `proactivePrivate` / `proactiveGroup` / `proactiveActiveDays` | `true` / `true` / `7` | 找不找别人和群、最近几天聊过才找 |
| `quietStart` / `quietEnd` / `proactiveRecentMinutes` | `01:00` / `09:00` / `30` | 免打扰、她说过话后几分钟内不触发 |
| `proactiveGroupContext` / `silenceToken` | `15` / `[不发]` | 群里带几条上下文（图片不限）、「不发」暗号（和插件一一致） |
| `autoCleanup` / `autoCleanupDays` / `autoCleanupImportance` | `true` / `90` / `0.2` | 自动清理 |
| `purgeForgotten` / `purgeForgottenDays` | `false` / `180` | 普通遗忘很久的自动彻底遗忘 |
| `consolidateEnabled` / `consolidateOverlap` / `consolidateGroups` / `careIntervalDays` | `true` / `0.5` / `20` / `7` | 定期整合、每几天保养一次 |
| `backupEnabled` / `backupTime` / `backupKeep` | `true` / `04:00` / `5` | 自动备份 |
| `backupItems` | 除 `sessionsMaster` 外全部 | 备份哪些：`persona` `core` `diary` `memory` `archiveMaster` `sessionsMaster` `settingsCompanion` `settingsBridge` `settingsDsh`；不导出配置密钥，原始会话可能包含聊天中的敏感内容 |
| `selfCheckQueries` | 三个问题 | 迁移后自检用的问题 |
| `logLevel` | `info` | 日志级别 |

## 数据目录

```
<DSH_HOME>/companion/
├── persona/persona.md, persona/history/
├── core/master.md, core/public.md, core/history-master/, core/history-public/
├── diary/2026-10-24.md, diary/monthly/2026-10.md
├── media/<sha256>.png   收到时下载的图片
├── backups/companion-<auto|manual|before-import>-YYYYMMDD-HHMMSS.tar.gz   备份包
└── companion.db          消息存档、dsh 会话的聊天流水、长期记忆（含向量）、彻底遗忘的指纹、整理进度、换下来的旧会话、整合记录、图记忆的关系网（SQLite，数据结构版本 5）
```

所有路径都相对这个目录。换电脑用设置页的「备份与迁移」导出再导入；也可以停掉 dsh 后整个目录拷走。

## 给其他插件用

别的插件怎么「变成她」，分三种：

| 别的插件是怎么工作的 | 会不会带上她的人格和记忆 |
|---|---|
| 给她加工具（比如「搜 B 站视频」「发弹幕」），在她自己的会话里由她调用 | **自动会**：调用工具、看结果、说话的都是她 |
| 自带预设、自己开会话 | 把那个预设的 id 加进设置「生效的预设」（或填 `*`）就会 |
| 在后台自己调模型（定时任务、自己拼提示词） | 用下面的接口取她的人格和记忆，自己放进提示词 |

接口挂在 `ctx.companion` 上（可选依赖，没装本插件时拿不到就跳过）。默认对其他插件全部开放，设置「给其他插件用」可以改成只给公开的，或者关掉。

```ts
ctx.inject(['companion'], async (ctx) => {
  // 她是谁：人格 + 核心记忆，prompt 可以直接当系统提示词
  const me = ctx.companion.identity()                       // 默认只给公开的（公开核心记忆）
  const forMaster = ctx.companion.identity({ audience: 'master' })   // 主人的核心记忆也带上
  const inSession = ctx.companion.identity({ sessionId })   // 按某个 dsh 会话判断是主人、私聊还是群聊

  // 和某件事相关的长期记忆（和她聊天时的召回一样：关键词 + 向量 + 关系网）
  const memories = await ctx.companion.recall('最近看的视频', { topK: 5 })   // [{ id, content, kind, importance, relevance, createdAt }]

  // 一整段：人格 + 核心记忆 + 相关记忆
  const system = await ctx.companion.prompt({ query: '要评论的视频标题', audience: 'public' })

  // 替她记一件事（by 必填，写明是哪个插件；默认记成公开记忆，可信度比她自己记的低）
  await ctx.companion.remember('看了一个讲深海鱼的视频，觉得很有意思', { by: 'bilibili', kind: 'event', importance: 0.4 })
})
```

截断或压缩上下文之前的通知：

```ts
// serial，最多等 60 秒：可以在这里先把要紧内容写进别处
ctx.on('companion/before-compact', async ({ sessionId, scope, mode, reason, transcript }) => {})
```

## 开发

```bash
scripts/setup-test-env.sh          # 装官方 Node 和 dsh 到 .cache/test-env
scripts/check.sh                   # 安装依赖、编译、单元测试、端到端测试（真实 dsh + dsh-napcat-bridge + 假模型 + 假 NapCat）、扫描密钥
node scripts/check-upstreams.mjs   # 看 dsh、dsh-napcat-bridge、Node 有没有新版本（对照 upstreams.json）
```

端到端测试要用旁边文件夹的 dsh-napcat-bridge（`../dsh-napcat-bridge`，或用 `BRIDGE_DIR` 指定），先在那里编译好。`lib/` 是编译产物，要提交进仓库。

## 许可证

AGPL-3.0-or-later。陪伴模式预设的工具列表照抄 dsh-web-app 的标准模式（MIT），上下文管理继承 dsh-compaction-basic（MIT），见 [NOTICE.md](NOTICE.md)。

### 0.14.1：移除独立判断

按用户要求移除独立群聊判断及其设置、额外模型请求和上下文接口。群聊命中正文唤醒词、真实 @机器人、引用机器人或唤醒前缀后，按既有访问规则直接进入正式回复流程。没有额外判断模型调用。正式回复的群上下文、人格和记忆继续沿用原流程。

### 0.14.2：设置帮助说明

统一重写全部现有中英文设置帮助，并为原先缺少说明的设置补充“？”角标。说明覆盖用途、适用范围、默认值、输入格式及关联条件；唤醒前缀、白名单与存档边界、会话模型生效时间等表述已核实。仅调整帮助文字及角标，功能、配置字段和默认值保持不变。

### 0.14.3：代码审查与精简

- 合并群上下文和主动聊天的存档图片读取，保持图片不限张数及 MIME 回退规则；清理无效分支、未使用导入与重复时间格式处理。
- 关键词召回共用一次查询分词和权重；复用记忆去重/取代查询，合并统计 SQL，减少分页重复读取和分组数组复制；备份图片使用 Set 去重。
- 简化设置页状态及规则更新，首次编辑日记只读取一次；读取失败显示原因。启用未使用变量/参数编译检查，完整检查只运行一次单测。
- 新增五项回归测试；保留全部配置、对外接口、数据库迁移、旧备份兼容、权限边界与现有功能。

### 0.16.0：移除完整环境备份

按用户要求删除完整环境备份的界面、配置项、API、任务队列、系统服务脚本、安装/恢复工具及专用测试。保留原有九项普通备份、导入和自动备份机制。dsh原始会话及其他新增备份选择仍在讨论中，本版不添加。

### 0.17.0：仅增加主人 QQ 私聊的原始会话备份

“主人私聊的 dsh 会话”（`sessionsMaster`）替换“别人私聊和群聊的存档”，保留独立的“主人私聊存档”。按 bridge 当前管理员 QQ 配置匹配其私聊会话，包含轮换历史、完整逻辑事件、被引用的持久化图片/文件附件及当前会话绑定；不复制整套附件目录。群聊、其他私聊及网页会话不在此项范围内；今后的新包也不再备份其他私聊和群聊的消息存档。已有记录和旧备份包不删除。

备份先刷新宿主日志，再读取有效前缀；导入创建新会话，迁移交付标记中的宿主会话 ID，挂接当前工作目录的工作区，并恢复当前主人私聊绑定。旧会话保留；若主人正在处理消息，绑定切换会拒绝，空闲后可重新导入。不恢复已不在当前管理员列表中的 QQ 会话。不新增媒体、密钥、登录态或运行环境的独立备份选项。此项需要 bridge ≥ 0.20.4；未安装桥接插件时，原有其他备份仍可使用。格式 1/2 的旧包仍可选择恢复当前支持的项目，废弃的 `archiveOthers` 不恢复、不转换为原始会话。
