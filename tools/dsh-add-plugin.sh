#!/bin/bash
# 从 npm 装一个插件进 web profile：下载 tarball → 解到 plugins/<name> → 软链 → 依赖 → 登记 bundle
set -euo pipefail
PKG="${1:?用法: dsh-add-plugin.sh <npm包名> [版本]}"
VER="${2:-latest}"
PROFILE=/home/example/.dsh/profiles/web
PLUGINS=$PROFILE/plugins
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

meta=$(curl -sf -m 30 "https://registry.npmjs.org/$PKG")
url=$(printf '%s' "$meta" | python3 -c "
import json,sys
d=json.load(sys.stdin)
ver=sys.argv[1]
v=d['dist-tags']['latest'] if ver=='latest' else ver
print(d['versions'][v]['dist']['tarball'])
print(v)
" "$VER")
tarball=$(printf '%s' "$url" | head -1); version=$(printf '%s' "$url" | tail -1)
echo "下载 $PKG@$version"
curl -sfL -m 300 -o "$TMP/p.tgz" "$tarball"
mkdir -p "$TMP/x" && tar xzf "$TMP/p.tgz" -C "$TMP/x" --strip-components=1
mkdir -p "$PLUGINS/$PKG"
rsync -a --delete "$TMP/x/" "$PLUGINS/$PKG/"
ln -sfn "../plugins/$PKG" "$PROFILE/node_modules/$PKG"
if [ -f "$PLUGINS/$PKG/package.json" ]; then
  deps=$(python3 -c "
import json;d=json.load(open('$PLUGINS/$PKG/package.json'))
print(len(d.get('dependencies') or {}))")
  if [ "$deps" != "0" ]; then
    echo "装依赖（$deps 个）…"
    (cd "$PLUGINS/$PKG" && npm install --omit=dev --no-audit --no-fund --silent >/dev/null 2>&1) || echo "  ⚠ 依赖安装失败，稍后手动检查"
  fi
fi
python3 - "$PKG" <<'PY'
import json,sys
pkg=sys.argv[1]
p='/home/example/.dsh/profiles/web/package.json'
d=json.load(open(p))
d.setdefault('dependencies',{})[pkg]=f'link:../plugins/{pkg}'
bundles=d.setdefault('dsh',{}).setdefault('profile',{}).setdefault('bundles',[])
if pkg not in bundles: bundles.append(pkg)
json.dump(d,open(p,'w'),ensure_ascii=False,indent=2)
print('  已登记 bundle:', pkg)
PY
echo "✅ $PKG@$version → $PLUGINS/$PKG"
echo "   下一步：重启宿主，然后回读核对（别只看这行输出）："
echo "     bash tools/restart-check-life.sh 15 && bash tools/dsh-verify-plugin.sh $PKG"
