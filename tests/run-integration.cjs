const path = require('node:path');
const fs = require('node:fs/promises');
const { spawn } = require('node:child_process');

(async () => {
  const root = path.resolve(__dirname, '..');
  const fixture = path.join(root, '.vscode-test', 'fixture');
  await fs.mkdir(path.join(fixture, '.vscode'), { recursive: true });
  await fs.mkdir(path.join(fixture, 'src'), { recursive: true });
  await fs.writeFile(path.join(fixture, '.vscode/vex_project_settings.json'), JSON.stringify({ project: { name: 'AIM_Test', platform: 'AIM', language: 'python', slot: 1, sdkVersion: 'AIM_20250901_10_00_00', python: { main: 'src/main.py' } } }));
  await fs.writeFile(path.join(fixture, 'src/main.py'), '#region VEXcode Generated Robot Configuration\nfrom vex import *\nrobot = Robot()\n#endregion VEXcode Generated Robot Configuration\n\nSIDE_LENGTH_MM = 100\nrobot.stop_all_movement()\n');
  const executable = process.env.AIM_AI_VSCODE || 'D:/Microsoft VS Code/Code.exe';
  for (const verify of process.env.AIM_AI_VISUAL === '1' ? ['0'] : ['0', '1']) await new Promise((resolve, reject) => {
    const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
    env.AIM_AI_HISTORY_VERIFY = verify;
    const child = spawn(executable, [fixture, `--extensionDevelopmentPath=${root}`, `--extensionTestsPath=${path.join(root, 'tests', 'integration.cjs')}`, '--disable-extensions', '--disable-workspace-trust', '--skip-welcome', '--skip-release-notes', `--user-data-dir=${path.join(root, '.vscode-test', 'user-data')}`, `--extensions-dir=${path.join(root, '.vscode-test', 'extensions')}`], { shell: false, windowsHide: process.env.AIM_AI_VISUAL !== '1', env, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`VS Code test exit ${code}`)));
  });
})().catch(err => { console.error(err); process.exitCode = 1; });
