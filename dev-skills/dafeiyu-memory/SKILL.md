---
name: dafeiyu-memory
description: 维护或调试大肥鱼的长期记忆时使用：persona.md 人格、companion.db 表结构与常用 SQL、remember-you 记忆管理界面/接口、备份、遗忘与隐私边界。
---

# 大肥鱼的人格与记忆

## 位置

- 人格：`/home/example/.dsh/companion/persona/persona.md`（运行时读取，改完下一轮/新会话生效，一般不用重启）。
- 记忆库：`/home/example/.dsh/companion/companion.db`（SQLite，WAL 模式，旁边有 `-wal`/`-shm`，**不要单独删**）。
- 自动备份：`/home/example/.dsh/companion/backups/`。
- 记忆管理界面：`http://127.0.0.1:3080/api/remember-you/ui`（remember-you 插件提供：浏览、purge、召回轨迹）。
- 小窝资料：`/home/example/dafeiyu-linux/大肥鱼小窝`（资料、表情包、任务输出）。

## companion.db 主要表

- `memories`：长期记忆主表。关键列：`id, scope, kind, content, importance, trust, writer, source_umo, source_session, created_at, status, hash, embedding, embed_model, last_recalled, recall_count, forgotten_at, superseded_by`。
  - `scope` 形如 `master:<QQ>`、`private:<QQ>`、`group:<群号>`、`public`；不同 scope 能想起的范围不同。
  - `created_at` / `forgotten_at` 是毫秒时间戳。
  - `hash` 是规范化内容的指纹，用于去重和 tombstone；**手改 content 必须同步 hash**，否则检索、去重、遗忘都会错。embedding 是 bge-m3 1024 维向量（BLOB），改了内容也需要重新嵌入。
- `messages` / `journal`：消息存档与日记；`cursors`：处理游标；`retired`：归档会话。
- `graph_entities` / `graph_edges` / `graph_mentions` / `graph_done`：记忆图谱与抽图去重。
- `ry_meta` / `ry_evidence` / `ry_traces` / `ry_changes`：remember-you 补充层（现实度、证据、召回轨迹、变更审计）。
- `consolidations`：记忆合并记录；`tombstones`：purge 后的指纹，**保留**，删了会让已遗忘内容复活。
- `meta`：插件键值状态。

## 常用查询（python3 自带 sqlite3）

```bash
python3 - <<'EOF'
import sqlite3
con = sqlite3.connect('file:/home/example/.dsh/companion/companion.db?mode=ro', uri=True)
q = """select id, scope, kind, substr(content,1,50), importance, status,
              datetime(created_at/1000,'unixepoch','localtime')
       from memories where status='active' order by id desc limit 20"""
for row in con.execute(q):
    print(row)
EOF
```

- 统计：`select status, count(*) from memories group by status;`
- 某联系人：`select id, content from memories where scope='master:OWNER_QQ' order by id desc limit 20;`
- 最近日记：`select datetime(time/1000,'unixepoch','localtime'), substr(text,1,120) from journal order by id desc limit 10;`
- 完整性：`pragma integrity_check;`

## 修改记忆的原则

1. 先只读查询，确认要改哪几条 `id`，把内容摘要给用户看，再动手。
2. 优先「新增正确记忆 + 把错的置 `status='forgotten'`、`forgotten_at=现在`」，不要硬删；彻底清除走 remember-you 界面/接口，它会写 tombstone。
3. 直接改库前先备份：
   ```bash
   python3 - <<'EOF'
   import sqlite3, time
   stamp = time.strftime('%Y%m%d-%H%M%S')
   src = sqlite3.connect('/home/example/.dsh/companion/companion.db')
   dst = sqlite3.connect(f'/home/example/.dsh/companion/backups/manual-{stamp}.db')
   src.backup(dst); dst.close(); src.close()
   EOF
   ```
4. 改完确认 `pragma integrity_check;` 和 `select count(*) from memories;`；一般要重启 DSH 让插件重读库（会中断当前界面）。
5. 人格改动：先备份 `persona.md`；不要把人设里写真实密码、令牌、手机号。

## 隐私

检索或导出记忆时只给摘要，不把主人隐私整段贴到公开处；涉及密码、令牌、手机号时打码。
