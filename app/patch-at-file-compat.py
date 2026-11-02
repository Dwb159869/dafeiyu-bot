from pathlib import Path
import shutil
p=Path('/home/example/.dsh/profiles/web/node_modules/dsh-at-file/lib/index.js')
b=Path('/home/example/dafeiyu-linux/backups/dsh-at-file-0.6.3-before-compat.js')
import json
assert json.loads((p.parents[1]/'package.json').read_text())['version'] == '0.6.3', 'Review compatibility before patching another release'
client=Path('/home/example/.dsh/profiles/web/node_modules/dsh-at-file/lib/client.js')
if 'function registerAtFileSettings(ctx, config)' in p.read_text() and 'createSnapshotStore(initial)' in client.read_text():
 print('At-file compatibility patch is already applied.')
 raise SystemExit(0)
if not b.exists():shutil.copy2(p,b)
s=p.read_text()
s=s.replace('import { settingsNamespace } from "@deepseek-ai/dsh-settings";','import HostSchema from "@deepseek-ai/schemastery";').replace('var AT_FILE_NAMESPACE = settingsNamespace("at-file");','var AT_FILE_NAMESPACE = "dsh-at-file";')
a='''function registerAtFileSettings(ctx) {
  return ctx.settings.register(AT_FILE_NAMESPACE, AtFileSettingsSchema, { applies: "live" });
}'''
b='''function registerAtFileSettings(ctx, config) {
  const fields = ["enabled", "ignoreFiles", "workspaceIgnoreFiles", "ignorePastedMentions"];
  const read = () => AtFileSettingsSchema(Object.fromEntries(fields.map(key => [key, config[key].get()])));
  return {
    get: read,
    async update(patch) {
      const form = ctx.settings.describe().find(item => item.ns === AT_FILE_NAMESPACE);
      if (!form) throw new Error("at-file settings form is unavailable");
      await ctx.settings.update(AT_FILE_NAMESPACE, patch, form.revision);
    }
  };
}'''
assert a in s;s=s.replace(a,b)
a='''var Config = Schema.object({
  maxIndexedFiles: Schema.natural().min(1).default(5e3),
  ignoreDirs: Schema.array(Schema.string()).default([...DEFAULT_IGNORE_DIRS])
});'''
b='''var Config = HostSchema.object({
  maxIndexedFiles: HostSchema.natural().min(1).default(5e3),
  ignoreDirs: HostSchema.array(HostSchema.string()).default([...DEFAULT_IGNORE_DIRS]),
  enabled: HostSchema.boolean().default(true).volatile(),
  ignoreFiles: HostSchema.array(HostSchema.any()).default([...DEFAULT_IGNORE_FILES]).volatile(),
  workspaceIgnoreFiles: HostSchema.array(HostSchema.any()).default([]).volatile(),
  ignorePastedMentions: HostSchema.boolean().default(true).volatile()
});'''
assert a in s;s=s.replace(a,b)
a='''  const resolved = Config(config2 ?? {});
  const settings = registerAtFileSettings(ctx);'''
b='''  const resolved = { maxIndexedFiles: config2.maxIndexedFiles, ignoreDirs: config2.ignoreDirs };
  const settings = registerAtFileSettings(ctx, config2);'''
assert a in s;s=s.replace(a,b)
needle='    const dispose = ctx.typert.register(TYPERT_MANIFEST);'
replacement='    // DSH 0.2.1 expects strict codec factories; this release bundled schema instances.\n    for (const descriptor of AT_FILE_INVOCATIONS) {\n      const codecs = [descriptor.result, ...descriptor.parameters.map(parameter => parameter.codec)];\n      for (const codec of codecs) {\n        if (codec?.mode === "strict" && typeof codec.create !== "function" && codec.schema) {\n          codec.create = () => codec.schema;\n        }\n      }\n    }\n    const dispose = ctx.typert.register(TYPERT_MANIFEST);'
assert needle in s;s=s.replace(needle,replacement);p.write_text(s)
print('At-file settings adapted to the installed DSH Config/volatile API; original code backed up.')
p=Path('/home/example/.dsh/profiles/web/node_modules/dsh-at-file/lib/client.js')
b=Path('/home/example/dafeiyu-linux/backups/dsh-at-file-0.6.3-client-before-compat.js')
if not b.exists():shutil.copy2(p,b)
s=p.read_text();a='var import_client = require("@deepseek-ai/dsh-client-runtime/client");'
b='''var import_client = {
  createSnapshotStore(initial) {
    let snapshot = initial;
    const listeners = new Set();
    return {
      getSnapshot: () => snapshot,
      set(value) { snapshot = value; for (const notify of [...listeners]) notify(); },
      subscribe(notify) { listeners.add(notify); return () => listeners.delete(notify); }
    };
  }
};'''
assert a in s;s=s.replace(a,b)
a='    const dispose = await ctx.remote.$mount(AT_FILE_REMOTE);'
b='''    for (const descriptor of AT_FILE_INVOCATIONS) {
      const codecs = [descriptor.result, ...descriptor.parameters.map(parameter => parameter.codec)];
      for (const codec of codecs) {
        if (codec?.mode === "strict" && typeof codec.create !== "function" && codec.schema) codec.create = () => codec.schema;
      }
    }
    const dispose = await ctx.remote.$mount(AT_FILE_REMOTE);'''
assert a in s;s=s.replace(a,b);p.write_text(s)
print('At-file client snapshot state and strict codecs adapted without additional packages.')
