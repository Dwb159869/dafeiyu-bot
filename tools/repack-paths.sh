#!/usr/bin/env bash
# 把仓库里写死的作者家目录（默认 /home/example）改成本机 $HOME。
# 用法：bash tools/repack-paths.sh [旧前缀]   —— 默认 /home/example
set -euo pipefail
OLD="${1:-/home/example}"
NEW="${HOME}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [ "$OLD" = "$NEW" ]; then
  echo "旧前缀和当前 \$HOME 一样（$OLD），不用改。"
  exit 0
fi
mapfile -t files < <(grep -rIl --exclude-dir=.git --exclude-dir=node_modules -- "$OLD" "$ROOT" || true)
if [ "${#files[@]}" -eq 0 ]; then
  echo "没有找到 $OLD，跳过。"
  exit 0
fi
for f in "${files[@]}"; do
  sed -i "s#$OLD#$NEW#g" "$f"
done
echo "已改写 ${#files[@]} 个文件：$OLD → $NEW"
echo "还要手动做："
echo "  1) plugins/*/cordis.patch.yml 里的 OWNER_QQ 换成你的 QQ 号"
echo "  2) cp .env.example .env 并填账号与 key"
