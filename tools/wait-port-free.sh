#!/usr/bin/env bash
# 等端口空出来再让宿主启动。
#
# 为什么需要：`systemctl restart` 时旧进程刚被 stop，它自己和留下的子进程还可能占着端口/文件锁一两秒，
# 新实例一起来就 StartupError 退出（status=1），而 unit 里没配 Restart=，于是就这么死着不起来了。
# 这个脚本放在 ExecStartPre：先等端口真空，顺便把过大的日志轮转掉，再交给真正的启动命令。
set -u
PORT="${1:-3080}"
WAIT="${2:-40}"
LOG=/home/example/.local/state/deepseek-harness/server.log

# 日志轮转：追加模式会越滚越大，超过 5MB 就挪走（下次启动重新开一个）
if [ -f "$LOG" ]; then
  size=$(stat -c %s "$LOG" 2>/dev/null || echo 0)
  if [ "$size" -gt 5242880 ]; then
    mv -f "$LOG" "$LOG.1"
  fi
fi

for _ in $(seq 1 "$WAIT"); do
  if ! ss -lnt 2>/dev/null | grep -q ":$PORT "; then
    printf '[wait-port-free] %s 端口 %s 空闲\n' "$(date '+%F %T')" "$PORT"
    exit 0
  fi
  sleep 1
done

printf '[wait-port-free] %s 等了 %s 秒，端口 %s 还被占着，仍然继续启动（让启动自己去报错）\n' \
  "$(date '+%F %T')" "$WAIT" "$PORT"
exit 0
