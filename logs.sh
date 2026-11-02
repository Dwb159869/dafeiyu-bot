#!/usr/bin/env bash
set -euo pipefail
base="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
service="${1:-dsh}"
case "$service" in
  dsh) tail -n 100 /home/example/.local/state/deepseek-harness/server.log ;;
  snowluma|qq) tail -n 100 "$base/native/logs/$service.log" ;;
  ollama) journalctl -u ollama.service -n 100 --no-pager ;;
  *) echo '用法：bash logs.sh [dsh|snowluma|qq|ollama]' >&2; exit 2 ;;
esac
