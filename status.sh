#!/usr/bin/env bash
set -euo pipefail
for unit in deepseek-harness dafeiyu-native-snowluma; do
  printf '%s: ' "$unit"
  systemctl --user is-active "$unit" || true
done
python3 /home/example/dafeiyu-linux/app/qq-status.py
ollama list
