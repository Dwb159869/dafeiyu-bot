#!/usr/bin/env bash
set -euo pipefail
base="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
if ollama show bge-m3 >/dev/null 2>&1; then
  echo '系统 Ollama 已有 bge-m3，无需下载。'
else
  ollama pull bge-m3
fi
