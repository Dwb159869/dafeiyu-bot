#!/usr/bin/env bash
set -euo pipefail
umask 077
node /opt/app/init.mjs
bind_ip="$(node -e 'const os=require("node:os"); const ip=Object.values(os.networkInterfaces()).flat().find(a=>a.family==="IPv4"&&!a.internal)?.address;if(!ip)process.exit(1);process.stdout.write(ip)')"
cd /workspace/vault
exec node /data/dsh/profiles/web/node_modules/@deepseek-ai/dsh/lib/bin.js web \
  --host "$bind_ip" --port 3080 --public-url "http://127.0.0.1:${DSH_PORT:-3080}" --no-open
