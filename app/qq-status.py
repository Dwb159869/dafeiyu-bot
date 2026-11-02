#!/usr/bin/env python3
"""看 QQ 协议端是否在跑、OneBot 是否已登录。

不写死任何账号：配置目录用环境变量 SNOWLUMA_DIR 指定（默认 ./native/snowluma），
里面的 onebot_<机器人QQ>.json 自动发现，accessToken 从里面读，打印时绝不输出。
"""
from pathlib import Path
import os, json, urllib.request

ROOT = Path(os.environ.get('DAFEIYU_HOME') or Path(__file__).resolve().parent.parent)
SNOWLUMA_DIR = Path(os.environ.get('SNOWLUMA_DIR') or ROOT / 'native' / 'snowluma')
HTTP_URL = os.environ.get('ONEBOT_HTTP_URL', 'http://127.0.0.1:3000/get_status')

running = []
for proc in Path('/proc').iterdir():
    if not proc.name.isdigit():
        continue
    try:
        if proc.stat().st_uid != os.getuid():
            continue
        args = (proc / 'cmdline').read_bytes().split(b'\0')
        if args[0] == b'/opt/QQ/qq' and not any(x.startswith(b'--type=') for x in args):
            running.append(int(proc.name))
    except (OSError, IndexError):
        pass


def token():
    for cfg in sorted(SNOWLUMA_DIR.glob('config/onebot_*.json')):
        try:
            return json.loads(cfg.read_text())['networks']['httpServers'][0]['accessToken']
        except (OSError, ValueError, KeyError, IndexError):
            continue
    return os.environ.get('ONEBOT_HTTP_TOKEN', '')


online = False
tk = token()
if tk:
    try:
        req = urllib.request.Request(
            HTTP_URL, data=b'{}',
            headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tk})
        with urllib.request.urlopen(req, timeout=3) as r:
            j = json.load(r)
            online = j.get('status') == 'ok' and bool(j.get('data', {}).get('online'))
    except (OSError, ValueError):
        pass

print('系统 QQ 窗口：' + ('运行中' if running else '未运行'))
print('QQ 机器人连接：' + ('已登录并在线' if online else '等待 QQ 登录或连接恢复'))
