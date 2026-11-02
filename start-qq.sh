#!/usr/bin/env bash
set -euo pipefail
base="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
systemctl --user start dafeiyu-native-snowluma.service dafeiyu-native-qq.service
echo '已打开系统独立 QQ 窗口。'
