#!/bin/bash
# 启动本机 ComfyUI（Qwen-Image 2.1 出图后端），给 dsh-image-studio 的 comfyui-qwen provider 用。
#
#   bash tools/comfy-start.sh            后台启动（已启动则只报状态）
#   bash tools/comfy-start.sh --fg       前台跑（调试用，Ctrl-C 退出）
#   bash tools/comfy-start.sh --status   只看状态
#   bash tools/comfy-start.sh --stop     停掉
#
# 日志：/home/example/dafeiyu-linux/state/comfyui.log
set -u

COMFY_DIR=/home/example/ComfyUI
PY=/home/example/anaconda3/envs/comfy/bin/python
PORT=8188
LOG_DIR=/home/example/dafeiyu-linux/state
LOG="$LOG_DIR/comfyui.log"
PIDFILE="$LOG_DIR/comfyui.pid"

mkdir -p "$LOG_DIR"

online() { curl -s -o /dev/null --max-time 3 "http://127.0.0.1:$PORT/system_stats"; }

case "${1:-}" in
  --status)
    if online; then
      echo "ComfyUI 在线（127.0.0.1:$PORT）"
      curl -s "http://127.0.0.1:$PORT/system_stats" | head -c 300; echo
    else
      echo "ComfyUI 没在跑"
    fi
    exit 0
    ;;
  --stop)
    if [ -f "$PIDFILE" ]; then
      pid=$(cat "$PIDFILE")
      kill "$pid" 2>/dev/null && echo "已停 pid=$pid"
      rm -f "$PIDFILE"
    else
      pkill -f "ComfyUI/main.py" 2>/dev/null && echo "已停（按进程名）" || echo "没在跑"
    fi
    exit 0
    ;;
esac

if online; then
  echo "ComfyUI 已经在线（127.0.0.1:$PORT），不用再起"
  exit 0
fi

if [ "${1:-}" = "--fg" ]; then
  cd "$COMFY_DIR" || exit 1
  exec "$PY" main.py --listen 127.0.0.1 --port "$PORT"
fi

cd "$COMFY_DIR" || exit 1
nohup "$PY" main.py --listen 127.0.0.1 --port "$PORT" >>"$LOG" 2>&1 &
echo $! > "$PIDFILE"
echo "启动中（pid=$(cat "$PIDFILE")），日志 $LOG"

for i in $(seq 1 90); do
  if online; then
    echo "起来了：http://127.0.0.1:$PORT （约 ${i} 秒）"
    exit 0
  fi
  if ! kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
    echo "进程退出了，看日志："
    tail -20 "$LOG"
    exit 1
  fi
  sleep 1
done

echo "90 秒还没起来，看日志："
tail -20 "$LOG"
exit 1
