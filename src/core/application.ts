import * as fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

export function applicationCandidates(configured: string, env: NodeJS.ProcessEnv = process.env): string[] {
  if (configured.trim()) return [configured.trim()];
  return [...new Set([
    ...[env.ProgramFiles, env['ProgramFiles(x86)']].filter((p): p is string => !!p).map(p => path.join(p, 'VEX Robotics', 'VEXcode AIM', 'VEXcode AIM.exe')),
    ...(env.LOCALAPPDATA ? [path.join(env.LOCALAPPDATA, 'Programs', 'VEXcode AIM', 'VEXcode AIM.exe'), path.join(env.LOCALAPPDATA, 'Programs', 'VEX Robotics', 'VEXcode AIM', 'VEXcode AIM.exe')] : [])
  ])];
}
export async function findApplication(configured = ''): Promise<string | undefined> {
  for (const file of applicationCandidates(configured)) {
    if (!path.isAbsolute(file) || path.basename(file).toLowerCase() !== 'vexcode aim.exe') continue;
    try { if ((await fs.stat(file)).isFile()) return file; } catch {}
  }
  return undefined;
}
export function launchPlan(executable: string, projectFile: string) {
  if (!path.isAbsolute(executable) || path.basename(executable).toLowerCase() !== 'vexcode aim.exe') throw new Error('请选择 VEXcode AIM.exe 的完整路径。');
  if (!path.isAbsolute(projectFile) || path.extname(projectFile).toLowerCase() !== '.aimpython') throw new Error('请选择已导出的 .aimpython 文件。');
  const env = { ...process.env };
  // VS Code's extension host may set this; Electron must launch as a desktop app.
  delete env.ELECTRON_RUN_AS_NODE;
  return { executable, args: [projectFile], options: { shell: false as const, detached: true, windowsHide: true, stdio: 'ignore' as const, env } };
}
export async function openInApplication(projectFile: string, configured = ''): Promise<string> {
  if (process.platform !== 'win32') throw new Error('自动打开 VEXcode AIM 目前支持 Windows。');
  const executable = await findApplication(configured);
  if (!executable) throw new Error('未找到 VEXcode AIM。可在设置“VEXcode AIM 应用路径”中指定 VEXcode AIM.exe。');
  if (!(await fs.stat(projectFile)).isFile()) throw new Error('导出的项目文件不存在。');
  const plan = launchPlan(executable, projectFile);
  await new Promise<void>((resolve, reject) => {
    const child = spawn(plan.executable, plan.args, plan.options);
    child.once('error', () => reject(new Error('VEXcode AIM 未能启动，请检查安装位置。')));
    child.once('spawn', () => { child.unref(); resolve(); });
  });
  return executable;
}
