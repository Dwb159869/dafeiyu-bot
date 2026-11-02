#!/bin/bash
# 收藏夹 36 条浅读：debrief --no-frames，结果落 /tmp/debrief/<BV>.txt
set -u
cd /home/example/.dsh/profiles/web/plugins/dsh-bili-whale || exit 1
mkdir -p /tmp/debrief
python3 - <<'PY' > /tmp/debrief/list.txt
import json
for x in json.load(open('/tmp/fav-full.json')):
    print(x['bvid'], x['title'].replace('\n',' '))
PY
n=0
while read -r bv title; do
  n=$((n+1))
  out=/tmp/debrief/$bv.txt
  [ -s "$out" ] && { echo "[$n] 跳过 $bv（已有）"; continue; }
  echo "[$n] $bv $title"
  timeout 180 node tools/bili.mjs debrief "$bv" --no-frames > "$out" 2>&1
  sz=$(wc -c < "$out")
  echo "    -> ${sz}B"
  sleep 2
done < /tmp/debrief/list.txt
echo "全部完成"
