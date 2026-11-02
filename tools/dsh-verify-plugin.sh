#!/bin/bash
# 点完回读：装完/改完插件，从宿主真实状态里把结果读回来核对，而不是相信"命令没报错"。
# 用法：dsh-verify-plugin.sh <包名或行 id> [更多…]
# 退出码：0 全部 enabled+active；1 有缺失或未启用；2 连不上宿主
set -uo pipefail
[ $# -ge 1 ] || { echo "用法: dsh-verify-plugin.sh <包名或行 id> [更多…]"; exit 2; }

TOKEN=$(grep -ho 'token=[A-Za-z0-9_-]*' "$HOME/.local/state/deepseek-harness/server.log" 2>/dev/null | tail -1 | cut -d= -f2)
if [ -z "${TOKEN:-}" ]; then echo "✗ 读不到宿主 token（server.log 里没有 dsh web 那行）"; exit 2; fi
COOKIE=$(mktemp); trap 'rm -f "$COOKIE"' EXIT
curl -sf -m 10 -c "$COOKIE" "http://127.0.0.1:3080/?token=$TOKEN" >/dev/null || { echo "✗ 宿主没响应（3080）"; exit 2; }
JSON=$(mktemp); trap 'rm -f "$COOKIE" "$JSON"' EXIT
curl -sf -m 20 -b "$COOKIE" -H 'content-type: application/json' \
  -d '{"type":"client-request","rpcId":"r1","method":"pluginManager/listPlugins","payload":{"args":{}}}' \
  "http://127.0.0.1:3080/api/pluginManager/listPlugins" > "$JSON" || { echo "✗ listPlugins 调用失败"; exit 2; }

python3 - "$JSON" "$@" <<'PY'
import json, sys
path, wanted = sys.argv[1], sys.argv[2:]
raw = json.load(open(path))
res = raw.get('result', {}) if isinstance(raw.get('result'), dict) else {}
rows = res.get('value') or res.get('rows') or raw.get('rows') or []
def text(v):
    if isinstance(v, dict): return str(v.get('text') or v.get('id') or '')
    return str(v or '')
bad = 0
for w in wanted:
    def hit(r):
        eid = text(r.get('entryId'))
        mod = text(r.get('moduleName'))
        return eid == w or mod == w or eid.endswith(':' + w) or mod.endswith('/' + w) or mod.split('/')[-1] == w
    hits = [r for r in rows if hit(r)]
    if not hits:
        print(f'✗ {w}: 宿主里查不到这一行（没装上，或者 patch 没生效）'); bad += 1; continue
    r = hits[0]
    enabled = bool(r.get('enabled'))
    phase = str(r.get('fiberPhase') or '')
    ok = enabled and phase == 'active'
    mark = '✓' if ok else '✗'
    print(f"{mark} {w}: enabled={enabled} phase={phase or '-'}")
    if not ok: bad += 1
sys.exit(0 if bad == 0 else 1)
PY
