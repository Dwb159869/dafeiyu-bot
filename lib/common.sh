#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
cd "$ROOT"
DC=(docker compose)
if ! docker info >/dev/null 2>&1; then
  if command -v sudo >/dev/null 2>&1; then DC=(sudo docker compose); else echo 'Docker 不可访问，请先启动 Docker 并检查权限。' >&2; exit 1; fi
fi
compose() { "${DC[@]}" --project-directory "$ROOT" --env-file "$ROOT/.env" -f "$ROOT/compose.yaml" "$@"; }
[[ -f "$ROOT/.env" && -f "$ROOT/.dafeiyu-linux" ]] || { echo '请先运行 bash install.sh' >&2; exit 1; }
