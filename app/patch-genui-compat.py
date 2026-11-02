from pathlib import Path
import shutil
p=Path('/home/example/.dsh/profiles/web/node_modules/dsh-genui/lib/index.js');a='configEnabled: config.promptEnabled !== false,';b="configEnabled: (typeof config.promptEnabled?.get === 'function' ? config.promptEnabled.get() : config.promptEnabled) !== false,"
s=p.read_text()
if b in s:
 print('GenUI live-config compatibility patch already applied.')
else:
 assert a in s,'Review the installed GenUI release before patching'
 dst=Path('/home/example/dafeiyu-linux/backups/dsh-genui-before-live-config-compat.js')
 if not dst.exists():shutil.copy2(p,dst)
 p.write_text(s.replace(a,b));print('GenUI now reads the actual live promptEnabled value.')
