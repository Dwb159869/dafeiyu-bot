#!/usr/bin/env bash
set -euo pipefail
umask 077
SOURCE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
target="${HOME}/dafeiyu-linux"
owner=''; bot=''; skip_model=0; plan=0
usage() { echo 'bash install.sh [--dir PATH] [--owner-qq NUMBER] [--bot-qq NUMBER] [--skip-model] [--plan]'; }
while (($#)); do
  case "$1" in
    --dir|--owner-qq|--bot-qq)
      (($#>=2)) || { usage; exit 2; }
      case "$1" in --dir) target="$2";; --owner-qq) owner="$2";; --bot-qq) bot="$2";; esac
      shift 2;;
    --skip-model) skip_model=1;shift;;
    --plan) plan=1;shift;;
    -h|--help) usage;exit 0;;
    *) usage;exit 2;;
  esac
done
[[ "$(uname -s)" == Linux ]] || { echo '此脚本仅用于 Linux。' >&2;exit 1; }
case "$(uname -m)" in x86_64|aarch64|arm64) ;; *) echo '仅支持 Linux amd64/arm64。' >&2;exit 1;; esac
target="$(realpath -m -- "$target")"
[[ "$target" != / && "$target" != *$'\n'* && "$target" != *','* ]] || { echo '安装路径无效。' >&2;exit 1; }
if [[ "$target" != "$SOURCE" ]]; then
  case "$target/" in "$SOURCE/"*) echo '目标目录不能放在安装包内部。' >&2;exit 1;; esac
  if [[ -d "$target" && -n "$(find "$target" -mindepth 1 -maxdepth 1 -print -quit)" && ! -f "$target/.dafeiyu-linux" ]]; then
    echo '目标目录已有其他文件，拒绝覆盖。' >&2;exit 1
  fi
fi
if [[ -f "$target/.dafeiyu-linux" ]] && ! grep -qx 'dafeiyu-linux-clean-v1' "$target/.dafeiyu-linux"; then echo '无法识别已有安装。' >&2;exit 1;fi
if ((plan)); then printf '目标：%s\n内容：联网下载软件，初始化全新数据，不导入旧记忆或对话，不启动机器人。\n' "$target";exit 0;fi
(cd "$SOURCE" && sha256sum --quiet -c SHA256SUMS) || { echo '安装包校验失败。' >&2;exit 1; }
if [[ "$target" != "$SOURCE" && ! -f "$target/.dafeiyu-linux" ]]; then mkdir -p -- "$target"; cp -a "$SOURCE/." "$target/";fi
cd "$target"
if [[ ! -f .dafeiyu-linux && ( -e state || -e vault || -e .env ) ]]; then echo '发现未登记的已有配置或数据，拒绝接管。' >&2;exit 1;fi
printf '%s\n' dafeiyu-linux-clean-v1 > .dafeiyu-linux
as_root() { if ((EUID==0)); then "$@";else sudo "$@";fi; }
if ! command -v docker >/dev/null 2>&1; then
  echo '安装 Docker 官方软件源和 Compose（需要 sudo 权限）……'
  # shellcheck disable=SC1091
  . /etc/os-release
  case "$ID" in ubuntu|debian) ;; *) echo '本发行版请先按 Docker 官方文档安装 Docker Engine 和 Compose，然后重试。' >&2;exit 1;; esac
  as_root apt-get update
  as_root apt-get install -y ca-certificates curl
  as_root install -m 0755 -d /etc/apt/keyrings
  mkdir -p install-downloads
  curl --fail --location --retry 3 "https://download.docker.com/linux/$ID/gpg" -o install-downloads/docker.asc
  as_root install -m 0644 install-downloads/docker.asc /etc/apt/keyrings/docker.asc
  codename="${UBUNTU_CODENAME:-${VERSION_CODENAME:-}}"
  [[ "$codename" =~ ^[a-z0-9]+$ ]] || { echo '无法识别发行版代号。' >&2;exit 1; }
  printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/%s %s stable\n' "$(dpkg --print-architecture)" "$ID" "$codename" > install-downloads/docker.list
  as_root install -m 0644 install-downloads/docker.list /etc/apt/sources.list.d/dafeiyu-docker.list
  as_root apt-get update
  as_root apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  as_root systemctl enable --now docker
fi
DOCKER=(docker)
if ! docker info >/dev/null 2>&1; then DOCKER=(sudo docker);fi
if ! "${DOCKER[@]}" info >/dev/null 2>&1 && command -v systemctl >/dev/null 2>&1; then as_root systemctl start docker;fi
"${DOCKER[@]}" info >/dev/null
"${DOCKER[@]}" compose version >/dev/null || { echo '缺少 Compose v2，请安装 Docker Compose 插件后重试。' >&2;exit 1; }
if [[ ! -f .env ]]; then
  if [[ -z "$owner" ]]; then read -r -p '请输入主人 QQ 号：' owner;fi
  if [[ -z "$bot" ]]; then read -r -p '请输入机器人 QQ 号：' bot;fi
  [[ "$owner" =~ ^[1-9][0-9]{4,11}$ && "$bot" =~ ^[1-9][0-9]{4,11}$ ]] || { echo 'QQ 号格式无效。' >&2;exit 1; }
  app_uid="${SUDO_UID:-$(id -u)}";app_gid="${SUDO_GID:-$(id -g)}"
  if [[ "$app_uid" == 0 ]]; then app_uid=1000;app_gid=1000;fi
  onebot="$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')"
  http_token="$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')"
  project="dafeiyu-$(printf '%s' "$target" | sha256sum | cut -c1-10)"
  printf 'COMPOSE_PROJECT_NAME=%s\nAPP_UID=%s\nAPP_GID=%s\nOWNER_QQ=%s\nBOT_QQ=%s\nONEBOT_TOKEN=%s\nONEBOT_HTTP_TOKEN=%s\nDSH_PORT=3080\nSNOWLUMA_PORT=5099\nNOVNC_PORT=6081\nDEEPSEEK_API_KEY=\n' "$project" "$app_uid" "$app_gid" "$owner" "$bot" "$onebot" "$http_token" > .env
fi
chmod 600 .env
# Only installer-generated numeric and hexadecimal fields are read; never source .env as shell code.
env_value() { sed -n "s/^$1=//p" .env | head -n1; }
app_uid="$(env_value APP_UID)";app_gid="$(env_value APP_GID)";bot="$(env_value BOT_QQ)"
onebot="$(env_value ONEBOT_TOKEN)";http_token="$(env_value ONEBOT_HTTP_TOKEN)"
[[ "$app_uid" =~ ^[0-9]+$ && "$app_gid" =~ ^[0-9]+$ && "$bot" =~ ^[1-9][0-9]{4,11}$ && "$onebot" =~ ^[a-f0-9]{64}$ && "$http_token" =~ ^[a-f0-9]{64}$ ]] || { echo '.env 配置无效。' >&2;exit 1; }
mkdir -p state/dsh state/snowluma/config state/qq-config state/qq-data state/ollama vault
if [[ ! -f "state/snowluma/config/onebot_$bot.json" ]]; then
  cat > "state/snowluma/config/onebot_$bot.json" <<JSON
{"networks":{"httpServers":[{"name":"dafeiyu-internal","enabled":true,"host":"0.0.0.0","port":3000,"path":"/","accessToken":"$http_token","messageFormat":"array","reportSelfMessage":false}],"wsClients":[{"name":"dafeiyu-dsh","enabled":true,"url":"ws://dsh:6199/ws","role":"Universal","accessToken":"$onebot","reconnectIntervalMs":3000,"messageFormat":"array","reportSelfMessage":false}],"wsServers":[],"httpClients":[]}}
JSON
fi
if [[ ! -f state/snowluma/config/onebot.json ]]; then printf '%s\n' '{"networks":{"httpServers":[],"wsClients":[],"wsServers":[],"httpClients":[]}}' > state/snowluma/config/onebot.json;fi
# Only newly created project directories are assigned to the container account.
if [[ ! -f .dafeiyu-permissions ]]; then as_root chown -R "$app_uid:$app_gid" state vault; printf '%s:%s\n' "$app_uid" "$app_gid" > .dafeiyu-permissions;fi
source lib/common.sh
if [[ -n "$(compose ps --status running -q dsh)" ]]; then echo '本实例已运行，请先 bash stop.sh，再重新安装。' >&2;exit 1;fi
compose --profile qq config --quiet
echo '下载镜像并构建 Linux 运行环境……'
compose --profile qq pull snowluma ollama
compose build dsh
if ((!skip_model)); then
  echo '下载 bge-m3 模型（不启动 QQ 或 DSH）……'
  compose up -d ollama
  trap 'compose stop ollama >/dev/null 2>&1 || true' EXIT
  ready=0
  for ((i=0;i<60;i++)); do if compose exec -T ollama ollama list >/dev/null 2>&1;then ready=1;break;fi;sleep 1;done
  ((ready)) || { echo 'Ollama 未就绪。' >&2;exit 1; }
  compose exec -T ollama ollama pull bge-m3
  compose stop ollama
  trap - EXIT
fi
echo '安装完成，机器人保持停止。先运行 bash start.sh 配置模型，再运行 bash start-qq.sh 完成 QQ 扫码。'
