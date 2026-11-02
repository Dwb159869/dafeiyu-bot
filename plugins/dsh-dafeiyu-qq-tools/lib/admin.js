// 系统级执行通道（给大肥鱼用）
//
// 为什么单独做：宿主会把会话关在沙箱里（workspace-write），她自己的 bash 工具够不到 /etc、~/.dsh 这些地方。
// 这两个工具跑在插件进程里，不受会话沙箱限制：
//   admin_sh   —— 以当前用户（example）身份执行命令，能读写整个家目录、跑脚本、装东西到 ~。
//   admin_sudo —— 需要 root 时用，密码从 ~/.dsh/secrets/sudo.pass 读（600 权限，不写进提示词、不落日志）。
//
// 安全线：只允许主人在私聊里用；每次都记账到小窝的 管理员日志.jsonl；超时和输出都截断。
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const MAX_OUT = 12000;
const DEFAULT_TIMEOUT = 120000;

const clip = (s, n = MAX_OUT) => (s.length > n ? '…（前面省略）\n' + s.slice(-n) : s);

/** 跑一条 shell 命令，返回 {exit, out, ms}。不走 shell:true，避免命令被二次解释。 */
export function runShell(command, { password, passwordless = false, timeoutMs = DEFAULT_TIMEOUT, cwd, env } = {}) {
  return new Promise((resolve) => {
    const started = Date.now();
    const useSudo = passwordless || typeof password === 'string';
    const argv = passwordless
      ? ['-n', 'bash', '-lc', command]
      : typeof password === 'string'
        ? ['-S', '-p', '', 'bash', '-lc', command]
        : ['-lc', command];
    const child = spawn(useSudo ? 'sudo' : 'bash', argv, {
      cwd: cwd ?? process.env.HOME,
      env: env ?? process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    let killed = false;
    const timer = setTimeout(() => {
      killed = true;
      child.kill('SIGKILL');
    }, Math.max(1000, timeoutMs));
    child.stdout.on('data', (b) => {
      if (out.length < MAX_OUT * 4) out += b.toString('utf8');
    });
    child.stderr.on('data', (b) => {
      if (err.length < MAX_OUT * 4) err += b.toString('utf8');
    });
    if (useSudo && !passwordless) {
      child.stdin.write(password + '\n');
      child.stdin.end();
    }
    child.on('error', (e) => {
      clearTimeout(timer);
      resolve({ exit: -1, out: '', err: String(e?.message ?? e), ms: Date.now() - started, killed });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ exit: code ?? -1, out, err, ms: Date.now() - started, killed });
    });
  });
}

/** 读管理员密码：文件必须存在且权限 600，否则当没配。 */
export async function readSudoPassword(file) {
  try {
    const st = await fsp.stat(file);
    if ((st.mode & 0o077) !== 0) return { ok: false, reason: '密码文件权限太松（应为 600）' };
    const text = (await fsp.readFile(file, 'utf8')).trim();
    if (text === '') return { ok: false, reason: '密码文件是空的' };
    return { ok: true, password: text };
  } catch {
    return { ok: false, reason: '还没存管理员密钥' };
  }
}

/** 记账：每次系统级调用都留一行，方便事后追。 */
export async function logAdminCall(file, entry) {
  try {
    await fsp.mkdir(path.dirname(file), { recursive: true });
    await fsp.appendFile(file, JSON.stringify({ t: Date.now(), ...entry }) + '\n', 'utf8');
  } catch {
    /* 记账失败不影响执行 */
  }
}

/** 主人配了 NOPASSWD 的话，就不必存密码：先问一句 `sudo -n true` 通不通。 */
export function canSudoWithoutPassword() {
  return new Promise((resolve) => {
    const child = spawn('sudo', ['-n', 'true'], { stdio: 'ignore' });
    child.on('error', () => resolve(false));
    child.on('close', (code) => resolve(code === 0));
  });
}

export const describeResult = (r) => {
  const head = r.killed
    ? '命令超时被杀掉了（可能是它在等输入）'
    : r.exit === 0
      ? '命令跑完了'
      : '命令退出码 ' + r.exit;
  const body = [r.out.trim(), r.err.trim()].filter(Boolean).join('\n');
  return head + '（' + (r.ms / 1000).toFixed(1) + 's）' + (body ? '\n' + clip(body) : '（没有输出）');
};

export { fs };
