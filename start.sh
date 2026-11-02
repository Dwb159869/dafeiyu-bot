#!/usr/bin/env bash
set -euo pipefail
base="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
systemctl --user start deepseek-harness.service dafeiyu-native-snowluma.service
systemctl --user start dafeiyu-native-qq.service
python3 "$base/open-panels.py"
echo '本机 DSH、SnowLuma 和系统 QQ 已启动。'
