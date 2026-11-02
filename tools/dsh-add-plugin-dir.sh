#!/bin/bash
# 从本地目录装插件：dsh-add-plugin-dir.sh <源目录> [包名]
set -euo pipefail
SRC="${1:?用法: dsh-add-plugin-dir.sh <源目录> [包名]}"
PROFILE=/home/example/.dsh/profiles/web
PLUGINS=$PROFILE/plugins
PKG="${2:-$(python3 -c "import json;print(json.load(open('$SRC/package.json'))['name'])")}"
DIRNAME="${PKG##*/}"
mkdir -p "$PLUGINS/$DIRNAME"
rsync -a --delete --exclude node_modules --exclude .git "$SRC/" "$PLUGINS/$DIRNAME/"
mkdir -p "$(dirname "$PROFILE/node_modules/$PKG")"
ln -sfn "../plugins/$DIRNAME" "$PROFILE/node_modules/$PKG"
if [ -f "$PLUGINS/$DIRNAME/package.json" ]; then
  deps=$(python3 -c "import json;print(len(json.load(open('$PLUGINS/$DIRNAME/package.json')).get('dependencies') or {}))")
  if [ "$deps" != "0" ]; then
    echo "装依赖（$deps 个）…"
    (cd "$PLUGINS/$DIRNAME" && npm install --omit=dev --no-audit --no-fund --silent >/dev/null 2>&1) || echo "  ⚠ 依赖安装失败"
  fi
fi
python3 - "$PKG" <<'PY'
import json,sys
pkg=sys.argv[1]
p='/home/example/.dsh/profiles/web/package.json'
d=json.load(open(p))
d.setdefault('dependencies',{})[pkg]=f'link:../plugins/{pkg.split("/")[-1]}'
b=d.setdefault('dsh',{}).setdefault('profile',{}).setdefault('bundles',[])
if pkg not in b: b.append(pkg)
json.dump(d,open(p,'w'),ensure_ascii=False,indent=2)
print('  已登记 bundle:', pkg)
PY
echo "✅ $PKG ← $SRC"
