#!/usr/bin/env bash
set -euo pipefail
systemctl --user stop dafeiyu-native-qq.service dafeiyu-native-snowluma.service
echo '机器人 QQ 和 SnowLuma 已停止，系统 DSH 继续运行。'
