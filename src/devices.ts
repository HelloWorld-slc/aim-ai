import * as vscode from 'vscode';
import { Projects } from './projects';
import { interpretVexResult } from './core/hardware';

const PREFIX = 'vexrobotics.vexcode.';
export class Devices {
  private busy = false;
  constructor(private projects: Projects, private report: (text: string) => void, private validate: () => Promise<boolean>) {}
  private async command(id: string): Promise<unknown> {
    const extension = vscode.extensions.getExtension('vexrobotics.vexcode');
    if (!extension) throw new Error('请安装 VEX Robotics 官方扩展。');
    const version = String(extension.packageJSON.version);
    if (!version.startsWith('0.8.')) throw new Error(`VEX ${version} 尚未适配。当前桥接按 0.8.x 命令实现，请使用官方面板操作。`);
    await extension.activate();
    const command = PREFIX + id;
    if (!(await vscode.commands.getCommands(true)).includes(command)) throw new Error(`当前 VEX 扩展没有提供 ${id}，请使用官方面板。`);
    return vscode.commands.executeCommand(command);
  }
  private async info(): Promise<any> {
    const result = await this.command('system.info.all') as any;
    if (typeof result?.json !== 'string') throw new Error('VEX 没有提供可读的设备状态。');
    try { return JSON.parse(result.json); } catch { throw new Error('VEX 设备状态格式不兼容。'); }
  }
  async status(): Promise<void> {
    const data = await this.info();
    const devices = Array.isArray(data.app) ? data.app : [];
    this.report(devices.length ? `VEX 检测到 ${devices.length} 个设备。\n${devices.map((d: any) => `${d.platform ?? '?'} · ${d.robotName ?? d.name ?? d.communication ?? '未命名'}`).join('\n')}\n已选设备：${data.selectedDevice?.communication ?? '未确认'}。这不表示下载已验证。` : 'VEX 未检测到正常运行的设备。请连接 USB、打开机器人，再查看官方 VEX 面板。');
  }
  async action(action: 'download' | 'run' | 'stop'): Promise<void> {
    if (!vscode.workspace.isTrusted) throw new Error('工作区未受信任。');
    if (action !== 'stop' && !vscode.workspace.getConfiguration('aimAI').get<boolean>('experimentalHardware')) throw new Error('硬件桥接等待实机验证。测试时请先启用 AIM AI 的 experimentalHardware 设置。');
    if (this.busy && action !== 'stop') throw new Error('另一个设备操作尚未结束。');
    // Stop remains reachable, even while download is pending; VEX owns transport scheduling.
    if (action === 'stop') {
      const result = await this.command('statusbar.stop');
      this.report(`已请求 VEX 停止。${interpretVexResult(result).detail}`); return;
    }
    this.busy = true;
    try {
      const project = await this.projects.current();
      const folders = vscode.workspace.workspaceFolders;
      if (folders?.length !== 1 || folders[0].uri.fsPath !== project.root) throw new Error('为避免下载到错误项目，请在单独的 VS Code 窗口打开该 AIM 项目文件夹。');
      await this.command('statusbar.listDevices');
      if (action === 'download') await this.command('statusbar.pickSlot');
      const current = await this.projects.current();
      const data = await this.info(); const selected = data.selectedDevice;
      if (!selected || selected.platform !== 'AIM' || !selected.communication) throw new Error('无法确认当前选中的 AIM 设备。请先在 VEX 面板选择机器人；本次未下载或运行。');
      const label = `${selected.robotName ?? selected.name ?? 'AIM'} (${selected.communication})`;
      if (action === 'download') {
        const doc = await vscode.workspace.openTextDocument(current.main);
        if (!await this.validate()) throw new Error('请先解决检查中的错误或 Python 检查环境问题。');
        if (!await doc.save()) throw new Error('主程序未保存，本次未下载。');
        const autoRun = vscode.workspace.getConfiguration('vexrobotics.vexcode', current.main).get<boolean>('Project.RunAfterDownload');
        if (autoRun) throw new Error('VEX 的 RunAfterDownload 已启用。请在 VEX 设置中关闭，确保下载不会自动运动。');
      }
      const confirmed = await vscode.window.showWarningMessage(action === 'download' ? `下载 ${current.name} 到 ${label} 的槽位 ${current.slot}？此槽位原程序会被覆盖。` : `运行 ${label} 槽位 ${current.slot} 中已有的程序？请确认场地已准备好；已有程序不一定是编辑器当前版本。`, { modal: true }, action === 'download' ? '下载' : '运行');
      if (!confirmed) return;
      const latest = (await this.info()).selectedDevice;
      if (latest?.communication !== selected.communication || latest?.platform !== 'AIM') throw new Error('设备选择发生变化，本次操作已取消。');
      const result = await this.command(action === 'download' ? 'system.download' : 'statusbar.play');
      const outcome = interpretVexResult(result);
      this.report(outcome.detail);
      if (outcome.state === 'failed') throw new Error(outcome.detail);
    } finally { this.busy = false; }
  }
}
