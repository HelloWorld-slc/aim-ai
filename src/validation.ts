import { spawn } from 'node:child_process';
import * as vscode from 'vscode';

export interface Issue { line: number; column: number; severity: 'error' | 'warning'; message: string }
export interface CheckResult { available: boolean; issues: Issue[]; note: string }

export async function checkPython(source: string, extensionPath: string): Promise<CheckResult> {
  const configured = vscode.workspace.getConfiguration('aimAI').get<string>('pythonPath')?.trim();
  const candidates: [string, string[]][] = configured ? [[configured, []]] : process.platform === 'win32' ? [['py', ['-3']], ['python', []]] : [['python3', []], ['python', []]];
  for (const [executable, args] of candidates) {
    try {
      const result = await invoke(executable, [...args, vscode.Uri.joinPath(vscode.Uri.file(extensionPath), 'resources', 'check_python.py').fsPath], source);
      return { available: true, issues: result, note: '已完成 Python 语法和常见平台混用检查；不等同于 MicroPython 编译、完整接口检查或实机验证。' };
    } catch (error) {
      if (configured) return { available: false, issues: [], note: `无法启动配置的 Python：${error instanceof Error ? error.message : '检查失败'}` };
    }
  }
  return { available: false, issues: [], note: '未找到可用的 Python 3。请设置 aimAI.pythonPath；本次未完成语法检查。' };
}

function invoke(executable: string, args: string[], source: string): Promise<Issue[]> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { windowsHide: true, shell: false, stdio: 'pipe' });
    let stdout = ''; let stderr = ''; let settled = false;
    const finish = (err?: Error, result?: Issue[]) => {
      if (settled) return; settled = true; clearTimeout(timeout);
      if (err) reject(err); else resolve(result ?? []);
    };
    const timeout = setTimeout(() => { child.kill(); finish(new Error('语法检查超时')); }, 8000);
    child.on('error', e => finish(e));
    child.stdin.on('error', () => {});
    child.stdout.on('data', b => { stdout += b.toString(); if (stdout.length > 200_000) { child.kill(); finish(new Error('检查输出过大')); } });
    child.stderr.on('data', b => { stderr = (stderr + b.toString()).slice(-1000); });
    child.on('close', code => {
      if (code !== 0) return finish(new Error(stderr || `Python exited ${code}`));
      try { const data = JSON.parse(stdout); if (!Array.isArray(data.issues)) throw new Error('无效检查结果'); finish(undefined, data.issues); } catch { finish(new Error('Python 检查输出格式无效')); }
    });
    child.stdin.end(JSON.stringify({ source }));
  });
}
