import * as vscode from 'vscode';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { RobotClient, RobotReport, RobotSnapshot, RobotTest, robotHost, robotSummary, robotTest, testLabel } from './core/robot';

function processRun(command: string, args: string[], signal?: AbortSignal, timeout = 180000): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true, shell: false, env: { ...process.env, PYTHONUTF8: '1', PYTHONNOUSERSITE: '1', PIP_DISABLE_PIP_VERSION_CHECK: '1' }, stdio: ['ignore', 'pipe', 'pipe'], signal });
    let output = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error('调试环境准备超时，请检查网络后重试。')); }, timeout);
    child.stdout.on('data', b => { output = (output + b).slice(-10000); });
    child.stderr.on('data', () => {});
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', code => { clearTimeout(timer); if (code === 0) resolve(output.trim()); else reject(new Error(`调试环境命令未成功（${code ?? '已中止'}）。请检查 Python、网络和安装权限。`)); });
  });
}

export class RobotDebug {
  private client = new RobotClient();
  private installed = false;
  private busy = false;
  private operation?: AbortController;
  private connected = false;
  private simulate = false;
  private host = '';
  private snapshot?: RobotSnapshot;
  private report?: RobotReport;
  private proposed?: { id: string; plan: RobotTest; explanation: string; expires: number };
  private lastError = '';
  private readyPath: string;
  constructor(private context: vscode.ExtensionContext, private emit: (type: string, data: unknown) => void) {
    this.readyPath = path.join(context.globalStorageUri.fsPath, 'robot-runtime-v1', 'ready.json');
    this.client.onClose = () => { this.connected = false; this.proposed = undefined; this.publish(); };
  }
  private get runtimeRoot() { return path.dirname(this.readyPath); }
  private get python() { return path.join(this.runtimeRoot, process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python'); }
  private get server() { return path.join(this.context.extensionPath, 'robot/server.py'); }
  async initialize() {
    try { const stamp = JSON.parse(await fs.readFile(this.readyPath, 'utf8')); await fs.access(this.python); this.installed = stamp.version === '0.4.0'; } catch { this.installed = false; }
    this.host = this.context.globalState.get<string>('robotHost', '');
    this.simulate = this.context.globalState.get<string>('robotMode', 'hardware') === 'simulation';
  }
  get canAutoConnect() { return this.installed && vscode.workspace.getConfiguration('aimAI').get<boolean>('robotAutoConnect', true) && (this.simulate || !!this.host); }
  state() { return { installed: this.installed, busy: this.busy, connected: this.connected, mode: this.simulate ? 'simulation' : 'hardware', host: this.host, autoConnect: vscode.workspace.getConfiguration('aimAI').get<boolean>('robotAutoConnect', true), autoConfigured: this.canAutoConnect, snapshot: this.snapshot, report: this.report, error: this.lastError, proposal: this.proposed ? { id: this.proposed.id, label: testLabel(this.proposed.plan), explanation: this.proposed.explanation } : undefined }; }
  async saveConnection(host: string, simulate: boolean) {
    if (this.connected || this.busy) throw new Error('请先结束当前调试会话再更改连接设置。');
    this.host = simulate ? '' : robotHost(host); this.simulate = simulate;
    await this.context.globalState.update('robotHost', this.host);
    await this.context.globalState.update('robotMode', simulate ? 'simulation' : 'hardware');
    this.publish();
  }
  private publish() { this.emit('robotState', this.state()); }
  private async operationRun(action: (signal: AbortSignal) => Promise<void>) {
    if (this.busy) throw new Error('机器人调试正在处理，请等待或点击停止 / 取消。');
    this.busy = true; this.lastError = ''; this.operation = new AbortController(); this.publish();
    try { await action(this.operation.signal); }
    catch (error) { this.lastError = error instanceof Error ? error.message : '机器人调试失败。'; throw error; }
    finally { this.busy = false; this.operation = undefined; this.publish(); }
  }
  async install() {
    if (this.connected) throw new Error('请先断开机器人再更新调试环境。');
    await this.operationRun(async signal => {
      await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'AIM AI · 准备本地机器人调试环境', cancellable: true }, async (progress, token) => {
        const cancellation = token.onCancellationRequested(() => this.operation?.abort());
        try {
          const configured = vscode.workspace.getConfiguration('aimAI').get<string>('pythonPath', '').trim();
          const candidates: [string, string[]][] = configured ? [[configured, []]] : process.platform === 'win32' ? [['py', ['-3']], ['python', []]] : [['python3', []]];
          let selected: [string, string[]] | undefined;
          for (const candidate of candidates) {
            try { await processRun(candidate[0], [...candidate[1], '-c', 'import sys; assert sys.version_info >= (3, 10)'], signal, 15000); selected = candidate; break; } catch { if (signal.aborted) throw new Error('已取消环境准备。'); }
          }
          if (!selected) throw new Error('需要 Python 3.10 或以上。安装后重试，或设置 aimAI.pythonPath。');
          progress.report({ message: '创建插件专用 Python 环境…' });
          await fs.mkdir(path.dirname(this.runtimeRoot), { recursive: true });
          await processRun(selected[0], [...selected[1], '-m', 'venv', this.runtimeRoot], signal);
          this.installed = false;
          await fs.rm(this.readyPath, { force: true });
          progress.report({ message: '安装固定版本的 MCP 与通信依赖…' });
          await processRun(this.python, ['-m', 'pip', 'install', '--only-binary=:all:', '-r', path.join(this.context.extensionPath, 'robot/requirements.lock')], signal);
          await processRun(this.python, ['-c', 'from mcp.server.fastmcp import FastMCP; import websocket'], signal, 15000);
          await fs.writeFile(this.readyPath, JSON.stringify({ version: '0.4.0' }));
          this.installed = true;
          this.emit('notice', '机器人调试环境已准备好。可以先使用模拟演示，或输入 IP 连接实机。');
        } finally { cancellation.dispose(); }
      });
    });
  }
  async connect(host: string, simulate: boolean, parentSignal?: AbortSignal) {
    if (!this.installed) throw new Error('请先点击“安装调试环境”。');
    if (this.connected) throw new Error('请先断开当前调试会话。');
    const selectedHost = simulate ? '' : robotHost(host);
    await this.operationRun(async signal => {
      const parentAbort = () => this.operation?.abort();
      if (parentSignal?.aborted) throw new Error('连接已取消。');
      parentSignal?.addEventListener('abort', parentAbort, { once: true });
      this.snapshot = undefined; this.report = undefined; this.proposed = undefined;
      this.host = selectedHost; this.simulate = simulate;
      try { this.snapshot = await this.client.connect(this.python, this.server, selectedHost, simulate, signal); this.connected = true; }
      catch { this.connected = false; throw new Error(signal.aborted ? '连接已取消。' : '连接未成功。请检查机器人 IP、Wi-Fi、固件及是否被其他控制会话占用。'); }
      finally { parentSignal?.removeEventListener('abort', parentAbort); }
      await this.context.globalState.update('robotHost', selectedHost);
      await this.context.globalState.update('robotMode', simulate ? 'simulation' : 'hardware');
      this.emit('notice', simulate ? '已连接模拟演示：所有结果都是模拟数据，不代表实机验证。' : '已进入实机远程调试会话。此会话不验证已下载的学生程序。');
    });
  }
  async ensureForAI(signal: AbortSignal) {
    if (this.connected) return;
    if (!this.canAutoConnect) throw new Error('请先安装调试环境、保存机器人 IP，并开启“AI 按需自动连接”。');
    this.emit('notice', this.simulate ? 'AI 正在按需连接模拟调试后台…' : `AI 正在按需连接机器人 ${this.host}…`);
    await this.connect(this.host, this.simulate, signal);
  }
  async read(includeVision = false, signal?: AbortSignal) {
    if (!this.connected) throw new Error('请先连接机器人或模拟演示。');
    if (this.busy) throw new Error('动作或连接正在处理，请等待后读取。');
    try { this.snapshot = await this.client.snapshot(includeVision, signal); this.report = undefined; this.lastError = ''; return this.snapshot; }
    catch (error) { this.lastError = error instanceof Error ? error.message : '状态读取失败。'; throw error; }
    finally { this.publish(); }
  }
  propose(value: unknown, explanation: string) {
    if (!this.connected) throw new Error('请先连接调试会话。');
    const plan = robotTest(value);
    this.proposed = { id: randomUUID(), plan, explanation: explanation.slice(0, 800), expires: Date.now() + 120000 };
    this.publish();
    return { pending: true, description: testLabel(plan), message: '仅提出方案，尚未执行。由用户点击“执行建议测试”；请等待用户提供结果。' };
  }
  async execute(value: unknown) {
    const plan = robotTest(value);
    if (!this.connected) throw new Error('请先连接调试会话。');
    await this.operationRun(async signal => {
      this.report = undefined;
      this.report = await this.client.test(plan, signal);
      this.snapshot = this.report.after;
      this.proposed = undefined;
      this.emit('notice', `测试结果已显示在机器人页：${testLabel(plan)}。点击“让 AI 分析结果”才会发送数据。`);
    });
  }
  async executeProposal(id: string) {
    const p = this.proposed;
    if (!p || p.id !== id || p.expires < Date.now()) throw new Error('测试建议已过期，请重新提出。');
    // Explicit click in the robot page is the only execution path for proposals.
    this.proposed = undefined; this.publish();
    await this.execute(p.plan);
  }
  async stop() {
    if (this.connected) {
      try { await this.client.stop(); this.emit('notice', '已发送停止请求，实际停止情况请观察机器人。'); }
      finally { this.operation?.abort(); }
    } else this.operation?.abort();
    this.proposed = undefined; this.publish();
  }
  async disconnect() {
    this.operation?.abort();
    await this.client.close(); this.connected = false; this.proposed = undefined; this.publish();
  }
  analysisPrompt() {
    const value = this.report ?? this.snapshot;
    if (!value) throw new Error('请先读取状态或完成一次测试。');
    return `请分析下面的机器人调试结果，结合当前代码提出下一步检查或修改建议。不要执行动作，不要把独立接口测试说成当前程序已通过实机验证。\n${robotSummary(value)}`;
  }
  dispose() { this.operation?.abort(); void this.client.close(); }
}
