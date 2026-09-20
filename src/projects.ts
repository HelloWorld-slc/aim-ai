import * as vscode from 'vscode';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { AimProject, EMPTY_SOURCE, SQUARE_SOURCE, parseAimProject, projectName, safeChild, serializeProject } from './core/project';

export interface Project { root: string; name: string; main: vscode.Uri; slot: number; sdk: string; settings: any }
export class Projects {
  private selected?: vscode.Uri;
  constructor(private context: vscode.ExtensionContext) {}

  async current(choose = false): Promise<Project> {
    if (!vscode.workspace.isTrusted) throw new Error('请先信任这个工作区。');
    if (!this.selected || choose) {
      const files = await vscode.workspace.findFiles('**/.vscode/vex_project_settings.json', '**/{node_modules,.git,.vscode-test}/**', 50);
      const candidates: { label: string; description: string; uri: vscode.Uri }[] = [];
      for (const uri of files) {
        try {
          const data = JSON.parse(Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8').replace(/^\uFEFF/, ''));
          if (data.project?.platform === 'AIM' && data.project?.language === 'python') candidates.push({ label: String(data.project.name), description: path.dirname(path.dirname(uri.fsPath)), uri });
        } catch { /* Other platforms and invalid files are not selected. */ }
      }
      if (!candidates.length) throw new Error('未找到 AIM Python 项目。请打开项目文件夹，或使用“新建项目 / 导入”。');
      const selected = candidates.length === 1 ? candidates[0] : await vscode.window.showQuickPick(candidates, { title: '选择 AIM AI 操作的项目' });
      if (!selected) throw new Error('已取消项目选择。');
      this.selected = selected.uri;
    }
    const settings = JSON.parse(Buffer.from(await vscode.workspace.fs.readFile(this.selected)).toString('utf8').replace(/^\uFEFF/, ''));
    const p = settings.project;
    if (p?.platform !== 'AIM' || p?.language !== 'python' || typeof p?.python?.main !== 'string') throw new Error('项目配置已变化，请重新选择 AIM Python 项目。');
    const root = path.dirname(path.dirname(this.selected.fsPath));
    const main = safeChild(root, p.python.main);
    await this.contained(root, main);
    if (!Number.isInteger(p.slot) || p.slot < 1 || p.slot > 8) throw new Error('项目槽位应为 1–8。请在 VEX 项目设置中修正。');
    return { root, name: String(p.name), main: vscode.Uri.file(main), slot: p.slot, sdk: String(p.sdkVersion || ''), settings };
  }

  async contained(root: string, target: string): Promise<void> {
    const actualRoot = await fs.realpath(root);
    const actual = await fs.realpath(target);
    const relative = path.relative(actualRoot, actual);
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error('项目文件通过链接指向项目外部，已停止操作。');
  }

  async create(imported?: AimProject, suggested = 'AIM_Project'): Promise<void> {
    if (!vscode.workspace.isTrusted) throw new Error('请先信任工作区。');
    const parent = await vscode.window.showOpenDialog({ canSelectFolders: true, canSelectFiles: false, canSelectMany: false, title: '选择新项目的上级文件夹' });
    if (!parent?.[0]) return;
    const name = await vscode.window.showInputBox({ title: 'AIM 项目名称', value: suggested, validateInput: v => { try { projectName(v); return undefined; } catch (e) { return (e as Error).message; } } });
    if (!name) return;
    const root = path.join(parent[0].fsPath, projectName(name));
    let source = imported?.textContent;
    if (source === undefined) {
      const template = await vscode.window.showQuickPick(['空白项目（启动后停止）', '100 mm 正方形（20% 速度）'], { title: '选择课堂模板' });
      if (!template) return;
      source = template.startsWith('空白') ? EMPTY_SOURCE : SQUARE_SOURCE;
    }
    const sdk = await this.findSdk();
    if (!sdk) throw new Error('未发现本机 AIM Python SDK。请先使用 VEX 官方扩展创建一个 AIM Python 项目并完成 SDK 下载。');
    // mkdir is exclusive: never merge into or overwrite an existing folder.
    await fs.mkdir(root);
    await fs.mkdir(path.join(root, 'src'));
    await fs.mkdir(path.join(root, '.vscode'));
    const settings = {
      extension: { version: vscode.extensions.getExtension('vexrobotics.vexcode')?.packageJSON.version ?? '', json: 2 },
      project: { name: name.trim(), description: 'AIM AI classroom project', creationDate: new Date().toISOString(), platform: 'AIM', language: 'python', slot: imported ? imported.slot + 1 : 1, sdkVersion: sdk.version, python: { main: 'src/main.py' } }
    };
    await fs.writeFile(path.join(root, 'src/main.py'), source, 'utf8');
    await fs.writeFile(path.join(root, '.vscode/vex_project_settings.json'), JSON.stringify(settings, null, 2));
    await fs.writeFile(path.join(root, '.vscode/settings.json'), JSON.stringify({ 'python.analysis.stubPath': sdk.stubs, 'python.analysis.extraPaths': [sdk.stubs], 'vexrobotics.vexcode.Project.RunAfterDownload': false }, null, 2));
    if (imported) {
      await fs.mkdir(path.join(root, '.aim-ai'));
      await fs.writeFile(path.join(root, '.aim-ai/imported.json'), JSON.stringify(imported, null, 2));
    }
    await fs.writeFile(path.join(root, 'README.md'), `# ${name}\n\n在 AIM AI 中描述任务、预览修改，然后检查。程序下载后在 AIM 机器人上运行。\n本项目不是正式竞赛模板，硬件动作需要实机测试。\n`);
    await fs.writeFile(path.join(root, 'AGENTS.md'), '本项目使用 VEX AIM 机器人端 Python。先查对应 AIM 官方 API，再修改 src/main.py。保留生成配置区域。不要混用 V5、IQ 或电脑端 WebSocket 接口。不要自动运行机器人。静态检查不等同于实机验证。\n');
    await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(root), { forceNewWindow: true });
  }

  async import(): Promise<void> {
    const files = await vscode.window.showOpenDialog({ filters: { 'AIM Python': ['aimpython'] }, canSelectMany: false });
    if (!files?.[0]) return;
    const stat = await vscode.workspace.fs.stat(files[0]);
    if (stat.size > 2_000_000) throw new Error('项目超过 2 MB。');
    const project = parseAimProject(Buffer.from(await vscode.workspace.fs.readFile(files[0])).toString('utf8'));
    await this.create(project, path.basename(files[0].fsPath, '.aimpython').replace(/[^\p{L}\p{N}_ -]/gu, '_'));
  }

  async export(project: Project, auto = false, checkedSource?: string): Promise<vscode.Uri | undefined> {
    const document = await vscode.workspace.openTextDocument(project.main);
    if (checkedSource !== undefined && checkedSource !== document.getText()) throw new Error('检查期间代码发生变化，请重新导出。');
    let original: AimProject | undefined;
    const metadata = path.join(project.root, '.aim-ai/imported.json');
    try {
      await fs.access(metadata);
      await this.contained(project.root, metadata);
      original = parseAimProject(await fs.readFile(metadata, 'utf8'));
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    const content = serializeProject(checkedSource ?? document.getText(), project.slot, original);
    const safeName = project.name.replace(/[^\p{L}\p{N}_ -]/gu, '_') || 'AIM_Project';
    let target: vscode.Uri | undefined;
    if (auto) {
      const folder = path.join(project.root, 'dist');
      await fs.mkdir(folder, { recursive: true });
      await this.contained(project.root, folder);
      target = vscode.Uri.file(path.join(folder, `${safeName}.aimpython`));
      try { await this.contained(project.root, target.fsPath); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
    } else target = await vscode.window.showSaveDialog({ defaultUri: vscode.Uri.file(path.join(project.root, `${safeName}.aimpython`)), filters: { 'AIM Python': ['aimpython'] } });
    if (!target) return;
    if (target.fsPath === project.main.fsPath || !target.fsPath.toLowerCase().endsWith('.aimpython')) throw new Error('请选择 .aimpython 文件，不能覆盖 Python 源码。');
    await vscode.workspace.fs.writeFile(target, Buffer.from(content));
    return target;
  }

  async findSdk(): Promise<{ version: string; stubs: string } | undefined> {
    const configured = vscode.workspace.getConfiguration().get<string>('vexrobotics.vexcode.Python.Sdk.Home');
    const standard = path.join(path.dirname(this.context.globalStorageUri.fsPath), 'vexrobotics.vexcode', 'sdk', 'python');
    for (const base of [...(configured ? [configured] : []), standard]) {
      const roots = [path.join(base, 'AIM'), base];
      for (const root of roots) {
        try {
          const versions = (await fs.readdir(root)).filter(n => /^AIM_\d/.test(n)).sort().reverse();
          for (const version of versions) {
            const stubs = path.join(root, version, 'vexaim', 'stubs');
            try { await fs.access(path.join(stubs, 'vex.py')); return { version, stubs }; } catch {}
          }
        } catch {}
      }
    }
    return undefined;
  }
}
