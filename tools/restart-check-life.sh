#!/usr/bin/env bash
# 安全重启 DSH：跟宿主进程彻底解耦，重启失败会留现场、会自己重试。
#
# 踩过的坑（写在这儿免得下次再踩）：
#   1) 在宿主会话里直接 `systemctl restart`：脚本是宿主的子进程，systemd stop 宿主时把整个 cgroup 一起杀，
#      脚本跑到一半就没了。→ 一进来就把自己丢进 systemd 的 transient unit（systemd-run），独立 cgroup。
#   2) 旧进程刚停、端口还没放出来就 start：新实例 StartupError，unit 里没配 Restart=，于是一直死着。
#      → unit 现在有 Restart=on-failure，且 ExecStartPre 会等端口空闲（tools/wait-port-free.sh）。
#   3) stdout 是 truncate：每次重启把崩溃现场覆盖掉，事后只能靠猜。→ 改成 append + 轮转。
#
# 用法：
#   bash tools/restart-check-life.sh              # 立刻重启
#   bash tools/restart-check-life.sh 15           # 15 秒后再重启（给当前回复留时间）
# 结果写到 /tmp/dsh-restart-report.log，失败时附诊断（journal + 日志尾巴 + status）。
set -u

DELAY="${1:-0}"

if [ -z "${DSH_RESTART_DETACHED:-}" ]; then
  command -v systemd-run >/dev/null 2>&1 || {
    echo "没有 systemd-run，没法安全重启；请在终端里手动 systemctl --user restart deepseek-harness" >&2
    exit 1
  }
  exec systemd-run --user --unit="dsh-restart-$$" --collect --quiet \
    --setenv=DSH_RESTART_DETACHED=1 -- "$0" "$@"
fi

LOG=/home/example/.local/state/deepseek-harness/server.log
REPORT=/tmp/dsh-restart-report.log
UNIT=deepseek-harness.service
START_TS=$(date '+%F %T')

say() {
  printf '%s %s\n' "$(date '+%F %T')" "$*" | tee -a "$REPORT"
}

say "===== 计划重启（延迟 ${DELAY}s）====="
sleep "$DELAY"

port_free() { ! ss -lnt 2>/dev/null | grep -q ':3080 '; }

wait_port_free() {
  for _ in $(seq 1 30); do
    port_free && return 0
    sleep 1
  done
  return 1
}

healthy() {
  # 心智层上线后标记从 dafeiyu-life 换成 dafeiyu-mind，两个都认
  ss -lnt 2>/dev/null | grep -q ':3080 ' &&
    grep -qE '\[dafeiyu-(mind|life)\] tools ready' "$LOG" 2>/dev/null
}

diagnose() {
  say "----- 诊断 -----"
  systemctl --user status "$UNIT" --no-pager -n 20 >>"$REPORT" 2>&1
  say "--- server.log 最后 120 行 ---"
  tail -n 120 "$LOG" >>"$REPORT" 2>&1
  say "--- journal 最后 60 行 ---"
  journalctl --user -u "$UNIT" --since "$START_TS" --no-pager | tail -n 60 >>"$REPORT" 2>&1
}

try_restart() {
  local n="$1"
  say "第 ${n} 次：stop"
  systemctl --user stop "$UNIT"
  if ! wait_port_free; then
    say "端口还被占着，清掉残留的 dsh web 进程"
    pkill -f "dsh/lib/bin.js web --host 127.0.0.1 --port 3080" 2>/dev/null || true
    sleep 2
    wait_port_free || say "端口仍然被占，继续尝试启动"
  fi

  say "第 ${n} 次：start"
  systemctl --user start "$UNIT" || say "start 命令返回非 0"

  for _ in $(seq 1 60); do
    sleep 2
    if healthy; then
      say "第 ${n} 次：启动成功（$(ss -lnt | grep -c ':3080 ') 个监听，插件已就绪）"
      return 0
    fi
  done
  say "第 ${n} 次：120 秒内没等到就绪"
  diagnose
  return 1
}

for i in 1 2 3; do
  if try_restart "$i"; then
    say "===== 重启完成，用时 $(( $(date +%s) - $(date -d "$START_TS" +%s 2>/dev/null || echo 0) ))s ====="
    exit 0
  fi
  say "等 10 秒再试"
  sleep 10
done

say "===== 三次都没起来，保持诊断在 $REPORT；服务现在是停着的，请人工看日志 ====="
exit 1
