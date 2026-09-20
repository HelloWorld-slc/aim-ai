import * as vscode from 'vscode';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { Assistant } from './assistant';
import { Projects } from './projects';
import { Knowledge } from './knowledge';
import { Devices } from './devices';
import { checkPython } from './validation';
import { PRESETS } from './core/presets';
import { openInApplication } from './core/application';
import { RobotDebug } from './robot';

export async function activate(context: vscode.ExtensionContext) {
  const output = vscode.window.createOutputChannel('AIM AI');
  const projects = new Projects(context);
  const knowledge = new Knowledge(path.join(context.extensionPath, 'resources', 'knowledge'));
  await knowledge.load();
  const robot = new RobotDebug(context, (type, data) => emit(type, data));
  await robot.initialize();
  const assistant = new Assistant(context, projects, knowledge, robot);
  await assistant.initialize();
  let view: vscode.WebviewView | undefined;
  const events: { type: string; data: unknown }[] = [];
  const emit = (type: string, data: unknown) => {
    if (type === 'clear' || type === 'conversation') events.length = 0;
    if (['user', 'assistant', 'notice', 'references', 'reference', 'usage'].includes(type)) {
      events.push({ type, data }); if (events.length > 80) events.shift();
    }
    void view?.webview.postMessage({ type, data });
    if (type === 'notice') output.appendLine(String(data));
  };
  assistant.onMessage = emit;
  for (const warning of assistant.conversations.warnings) output.appendLine(warning);
  const devices = new Devices(projects, text => emit('notice', text), () => assistant.check(false));
  const guard = (fn: () => Promise<unknown>) => async () => {
    try { await fn(); } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      emit('notice', message); void vscode.window.showErrorMessage(`AIM AI：${message}`);
    } finally { await state(); }
  };
  async function state() {
    await view?.webview.postMessage({ type: 'robotState', data: robot.state() });
    const config = vscode.workspace.getConfiguration('aimAI');
    const model = config.get<string>('model', '');
    const providers = PRESETS.map(p => ({ ...p, icon: view?.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', 'providers', p.icon)).toString() }));
    await view?.webview.postMessage({ type: 'state', data: { model: model || '尚未配置', endpoint: config.get<string>('baseUrl', ''), provider: config.get<string>('provider', 'custom'), providers, streamResponses: config.get<boolean>('streamResponses', true), thinking: assistant.thinkingState(), openAfterExport: config.get<boolean>('openAfterExport', true), busy: assistant.busy, proposal: assistant.proposal, topics: knowledge.catalog(), hardware: config.get<boolean>('experimentalHardware', false), autoExport: config.get<boolean>('autoExport', false), activeId: assistant.conversationState().activeId, chats: assistant.conversations.list() } });
  }
  async function openTopic(id?: string) {
    const topic = id ? knowledge.topics.find(t => t.id === id) : await vscode.window.showQuickPick(knowledge.topics.map(t => ({ ...t, label: t.title, description: t.parent === 'logic' ? 'Python / Logic' : t.group === 'python' ? 'Python' : '项目与课堂', detail: t.keywords.join(' · ') })), { title: 'AIM AI · 内置参考资料', matchOnDescription: true, matchOnDetail: true });
    if (!topic) return;
    await vscode.window.showTextDocument(vscode.Uri.joinPath(context.extensionUri, 'resources', 'knowledge', topic.file), { preview: true });
  }
  async function exportProject(auto = false) {
    const project = await projects.current(); const doc = await vscode.workspace.openTextDocument(project.main);
    const source = doc.getText();
    const result = await checkPython(source, context.extensionPath);
    if (result.issues.some(i => i.severity === 'error')) throw new Error('程序有语法错误，本次未导出。请点击“检查代码”。');
    const uri = await projects.export(project, auto, source);
    if (uri) {
      emit('notice', `${auto ? '自动导出' : '已导出'}：${uri.fsPath}\n${result.available ? '语法检查通过。' : result.note}`);
      const settings = vscode.workspace.getConfiguration('aimAI');
      if (!auto && settings.get<boolean>('openAfterExport', true)) {
        try {
          await openInApplication(uri.fsPath, settings.get<string>('applicationPath', ''));
          emit('notice', '已将项目交给 VEXcode AIM 打开。若应用提示保存现有项目，请先处理该提示。');
        } catch (error) {
          const note = `文件已成功导出，但自动打开未完成：${error instanceof Error ? error.message : '启动失败'}`;
          emit('notice', note); void vscode.window.showWarningMessage(note);
        }
      } else if (!auto) emit('notice', '可在 VEXcode AIM 的 File → Open 中打开导出文件。');
    }
  }
  const commands: Record<string, () => Promise<unknown>> = {
    open: async () => vscode.commands.executeCommand('aimAI.assistant.focus'),
    configure: () => assistant.configure(), testConnection: () => assistant.test(), clearKey: () => assistant.clearKey(),
    newChat: () => assistant.clear(),
    newProject: () => projects.create(), importProject: () => projects.import(), exportProject: () => exportProject(),
    check: () => assistant.check(), docs: () => openTopic(), restore: () => assistant.restore(),
    deviceStatus: () => devices.status(), download: () => devices.action('download'), run: () => devices.action('run'), stop: () => devices.action('stop'),
    robotGuide: async () => { await vscode.window.showTextDocument(vscode.Uri.joinPath(context.extensionUri, 'docs', 'ROBOT_DEBUG.md'), { preview: true }); },
    robotInstall: () => robot.install(), robotDisconnect: () => robot.disconnect(), robotStop: () => robot.stop(),
    robotSnapshot: () => robot.read(false), robotVision: () => robot.read(true), robotAnalyze: () => assistant.send(robot.analysisPrompt())
  };
  for (const [name, fn] of Object.entries(commands)) context.subscriptions.push(vscode.commands.registerCommand(`aimAI.${name}`, guard(fn)));
  context.subscriptions.push(output, { dispose: () => { assistant.dispose(); robot.dispose(); } }, vscode.window.registerWebviewViewProvider('aimAI.assistant', {
    resolveWebviewView(webviewView) {
      view = webviewView;
      view.webview.options = { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')] };
      const nonce = randomBytes(18).toString('base64');
      const js = view.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', 'webview.js'));
      const css = view.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', 'style.css'));
      view.webview.html = html(nonce, view.webview.cspSource, js.toString(), css.toString());
      context.subscriptions.push(view.webview.onDidReceiveMessage(message => {
        if (!message || typeof message.type !== 'string') return;
        void guard(async () => {
          switch (message.type) {
            case 'ready':
              await view?.webview.postMessage({ type: 'conversation', data: assistant.conversationState() });
              if (assistant.liveMessage) await view?.webview.postMessage({ type: 'chatMessage', data: assistant.liveMessage });
              if (!assistant.conversationState().activeId) for (const item of events) await view?.webview.postMessage(item);
              for (const warning of assistant.conversations.warnings) await view?.webview.postMessage({ type: 'notice', data: warning });
              break;
            case 'send': if (typeof message.prompt === 'string') await assistant.send(message.prompt, message.robotDebug === true); break;
            case 'robotConnect': if (typeof message.host === 'string' && typeof message.simulate === 'boolean') await robot.connect(message.host, message.simulate); break;
            case 'robotSaveConnection': if (typeof message.host === 'string' && typeof message.simulate === 'boolean') await robot.saveConnection(message.host, message.simulate); break;
            case 'robotAutoConnect': if (typeof message.value === 'boolean' && !assistant.busy) await vscode.workspace.getConfiguration('aimAI').update('robotAutoConnect', message.value, vscode.ConfigurationTarget.Global); break;
            case 'robotTest': await robot.execute(message.plan); break;
            case 'robotExecuteProposal': if (typeof message.id === 'string') await robot.executeProposal(message.id); break;
            case 'copyCode': if (typeof message.text === 'string' && message.text.length <= 120000) await vscode.env.clipboard.writeText(message.text); break;
            case 'openLink': { if (typeof message.url === 'string') { const url = new URL(message.url); if (['https:', 'http:'].includes(url.protocol) && !url.username && !url.password) await vscode.env.openExternal(vscode.Uri.parse(url.href)); } break; }
            case 'streamResponses': if (typeof message.value === 'boolean' && !assistant.busy) await vscode.workspace.getConfiguration('aimAI').update('streamResponses', message.value, vscode.ConfigurationTarget.Global); break;
            case 'cancel': assistant.cancel(); break;
            case 'thinking': if (typeof message.value === 'string') await assistant.setThinking(message.value); break;
            case 'openAfterExport': if (typeof message.value === 'boolean') await vscode.workspace.getConfiguration('aimAI').update('openAfterExport', message.value, vscode.ConfigurationTarget.Global); break;
            case 'clear': await assistant.clear(); break;
            case 'configureProvider': if (typeof message.id === 'string') await assistant.configure(message.id); break;
            case 'providerDocs': { const p = PRESETS.find(p => p.id === message.id); if (p) await vscode.env.openExternal(vscode.Uri.parse(p.docs)); break; }
            case 'openChat': if (typeof message.id === 'string') await assistant.openConversation(message.id); break;
            case 'renameChat': if (typeof message.id === 'string') await assistant.renameConversation(message.id); break;
            case 'deleteChat': if (typeof message.id === 'string') await assistant.deleteConversation(message.id); break;
            case 'preview': await assistant.preview(); break;
            case 'apply': await assistant.apply(); break;
            case 'topic': if (typeof message.id === 'string') await openTopic(message.id); break;
            case 'selectProject': {
              const p = await projects.current(true); await vscode.window.showTextDocument(p.main, { preview: false });
              emit('notice', `项目：${p.name}\n主程序：${p.main.fsPath}\nSDK：${p.sdk} · 槽位 ${p.slot}`); break;
            }
            case 'command': if (typeof message.name === 'string' && Object.hasOwn(commands, message.name)) await commands[message.name](); break;
          }
        })();
      }));
      context.subscriptions.push(view.onDidDispose(() => { view = undefined; }));
    }
  }));
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => { if (e.affectsConfiguration('aimAI')) void state(); }));
  let exporting = false;
  const queuedExports = new Map<string, vscode.Uri>();
  context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(doc => {
    if (!doc.fileName.endsWith('.py') || !vscode.workspace.getConfiguration('aimAI').get<boolean>('autoExport')) return;
    queuedExports.set(doc.uri.toString(), doc.uri);
    if (exporting) return;
    exporting = true;
    void guard(async () => {
      try {
        while (queuedExports.size) {
          const p = await projects.current();
          const selected = queuedExports.has(p.main.toString());
          queuedExports.clear();
          if (selected) {
            try { await exportProject(true); }
            catch (error) {
              // A newer save may invalidate the source while Python checks it.
              // Retry that pending version instead of dropping the latest save.
              if (!queuedExports.has(p.main.toString())) throw error;
            }
          }
        }
      } finally { exporting = false; queuedExports.clear(); }
    })();
  }));
  // Export only a small test/debug surface, never a general command execution API.
  return { knowledge, projects, assistant, exportProject, robot };
}

function html(nonce: string, csp: string, script: string, style: string): string {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${csp}; script-src 'nonce-${nonce}'; img-src ${csp};"><link rel="stylesheet" href="${style}"><title>AIM AI</title></head><body>
  <header><div class="brand"><span class="brand-mark">AI</span><div><h1>AIM AI</h1><p>VEX AIM 编程助手</p></div></div><button class="icon-button" data-tab="models" title="模型服务与 API" aria-label="模型服务与 API">⚙</button></header>
  <nav aria-label="功能导航"><button class="tab active" data-tab="chat">编程</button><button class="tab" data-tab="history">历史</button><button class="tab" data-tab="models">模型</button><button class="tab" data-tab="project" title="项目与设备">项目</button><button class="tab" data-tab="robot">机器人</button><button class="tab" data-tab="docs">资料</button></nav>
  <main>
    <section id="chat" class="page active"><div class="model-row"><button id="model" class="model-select" data-tab="models"><img id="model-icon" alt="" hidden><span id="model-name">尚未配置</span><span aria-hidden="true">⌄</span></button><button class="text-button" data-command="testConnection">测试连接</button></div><div class="thinking-row"><label for="thinking-effort">思考强度</label><select id="thinking-effort"><option value="default">预设默认</option></select></div><p id="thinking-note" class="muted thinking-note"></p><div class="chat-heading"><span id="chat-title">新对话</span><span class="muted">本地保存</span></div>
      <div id="messages" role="log" aria-live="polite"><div id="welcome" class="welcome"><span class="eyebrow">从一个小任务开始</span><h2>描述想让机器人<br>完成的动作。</h2><p>先查 AIM 资料，再预览修改。每一步都可以检查和恢复。</p><div class="suggestions"><button data-prompt="请让机器人以20%速度走边长100毫米的正方形，最后停止。保留机器人配置区域。">走一个正方形 ↗</button><button data-prompt="请先查视觉资料，解释如何获取足球检测信息。暂时不要移动机器人。">认识足球视觉 ↗</button><button data-prompt="检查当前代码是否混用了其他VEX平台接口，说明需要实机测试的部分。">检查当前程序 ↗</button></div></div></div>
      <div id="proposal" class="proposal" hidden><strong>代码修改已准备好</strong><div class="diff-stats"><span id="diff-added"></span><span id="diff-removed"></span></div><p id="proposal-text"></p><div class="button-row"><button data-action="preview">查看差异</button><button class="primary" data-action="apply">应用修改</button></div></div>
      <label class="robot-assist-option"><input id="robot-assist" type="checkbox" disabled> 本次允许 AI 读取机器人状态、提出测试建议</label><div class="composer"><label class="sr-only" for="prompt">编程任务</label><textarea id="prompt" rows="4" maxlength="8000" placeholder="例如：找到足球后转向它；球丢失时停止前进…"></textarea><div class="composer-footer"><button class="text-button" data-action="clear" title="开始新对话，已有记录保留在历史中">＋ 新对话</button><span id="request-status"></span><button id="cancel" data-action="cancel" hidden>取消</button><button id="send" class="primary" data-action="send">发送 ↑</button></div></div><p class="footnote">对话自动保存在本机。发送时会将当前程序、近期对话与相关资料交给所选模型服务。</p>
    </section>
    <section id="history" class="page"><div class="section-intro"><span class="eyebrow">当前工作区 · 本机记录</span><h2>对话历史</h2><p>新对话会保留旧记录。重新打开后可以继续提问。</p></div><button class="wide" data-action="clear">＋ 新对话</button><label class="sr-only" for="chat-search">搜索对话标题或项目</label><input id="chat-search" type="search" placeholder="搜索标题或项目…"><div id="chat-list"></div><p class="footnote">历史中的代码是当时的建议副本。继续对话时会重新读取当前程序；旧建议不会自动应用。</p></section>
    <section id="models" class="page"><div class="section-intro"><span class="eyebrow">常用模型服务</span><h2>选择你的 AI</h2><p>选择服务，确认模型并填写 API Key。图标随插件提供。</p></div><label class="export-option"><input id="stream-responses" type="checkbox" checked> 流式输出，边生成边显示</label><p class="muted">思考区展示服务商返回的内容；模型未提供时只显示回答与进度。</p><div id="providers"></div><button class="wide" data-provider="custom">自定义服务 / 本地模型</button><div class="card quiet"><p>预设可修改地址和模型 ID。API Key 保存于 VS Code 凭据存储。可用模型与费用以服务商账户为准。</p><button class="wide" data-command="testConnection">测试当前连接</button></div></section>
    <section id="project" class="page"><div class="section-intro"><span class="eyebrow">项目工作台</span><h2>从代码到机器人</h2><p>源码是主版本，导出文件用于 VEXcode AIM。</p></div><div class="card"><h3>课堂项目</h3><div class="grid"><button data-command="newProject">＋ 新建项目</button><button data-action="selectProject">选择主程序</button><button data-command="importProject">导入 .aimpython</button><button data-command="exportProject">导出 .aimpython</button><button data-command="check">检查代码</button><button data-command="restore">恢复上一版</button></div><label class="export-option"><input id="open-after-export" type="checkbox" checked> 导出后用 VEXcode AIM 打开</label><p id="auto-export" class="muted"></p></div><div class="card"><h3>机器人 <span class="badge">实验性桥接</span></h3><p>复用已安装的 VEX 官方扩展。先确认机器人与槽位，再下载；运行单独操作。</p><button class="wide" data-command="deviceStatus">读取设备状态</button><div class="button-row"><button id="download" data-command="download">下载</button><button id="run" data-command="run">运行</button><button class="stop" data-command="stop">请求停止</button></div><p id="hardware-state" class="muted"></p></div><div class="card quiet"><h3>兼容状态</h3><p>已验证：导出项目可在 VEXcode AIM 4.67.0 打开。</p><p>待验证：真实模型工具调用与机器人下载、运行。</p><p>尚未实现：蓝牙直连下载、官方编辑器实时双向同步。</p></div><button class="text-button" data-command="clearKey">删除当前 API 密钥</button></section>
    <section id="docs" class="page"><div class="section-intro"><span class="eyebrow">随插件提供 · 离线可读</span><h2>AIM 参考资料</h2><p>包含 Python 全部 15 个分类与 Logic 的 12 个子页。每项提供中文速查、接口索引和官方链接。</p></div><label class="sr-only" for="topic-search">搜索资料、方法名或关键词</label><input id="topic-search" type="search" placeholder="搜索：视觉、线程、draw_rectangle…" autocomplete="off"><p id="topic-count" class="muted" role="status" aria-live="polite"></p><div id="topics"></div><div class="card quiet"><p>AI 按任务选取相关资料，也能继续查阅其他条目。MicroPython 库页附 14 个模块的官方文档链接。</p><p>资料整理于 2026-09-20。完整参数与示例可从各页官方链接继续查看。</p></div></section>
    <section id="robot" class="page"><div class="section-intro"><span class="eyebrow">本地调试 · 按需发送摘要</span><h2>观察，再调整</h2><p>读取状态、测试单个动作，把结果交给 AI 分析。</p><button data-command="robotGuide">查看配网与使用教程</button></div>
      <div class="card"><h3>调试会话</h3><button id="robot-install" class="wide" data-command="robotInstall">安装调试环境</button><p class="muted">需要 Python 3.10+。依赖安装到插件专用环境。</p><label for="robot-mode">模式</label><select id="robot-mode"><option value="simulation">模拟演示（不连接机器人）</option><option value="hardware">真实机器人（Wi-Fi）</option></select><label for="robot-host">机器人 IP</label><input id="robot-host" placeholder="192.168.4.1" maxlength="15" autocomplete="off"><p class="muted">连接实机会开启新的远程调试会话并重置会话朝向。请先结束其他控制程序；此功能不能旁观验证已下载的程序。</p><button id="robot-save" class="wide">保存连接设置（暂不连接）</button><label class="export-option"><input id="robot-auto-connect" type="checkbox" checked> AI 按需自动连接，无需再次确认</label><p class="muted">只在 AI 需要状态时连接；自动连接也会开启远程调试会话。关闭后仍可手动连接。</p><div class="button-row"><button id="robot-connect" class="primary">连接调试</button><button id="robot-disconnect" data-command="robotDisconnect">断开</button></div><button id="robot-stop" class="stop wide" data-command="robotStop">停止 / 取消</button><p id="robot-status" role="status"></p><p id="robot-error" role="alert"></p></div>
      <div class="card"><h3>读取状态</h3><div class="button-row"><button id="robot-snapshot" data-command="robotSnapshot">电量与位置</button><button id="robot-vision" data-command="robotVision">足球与目标识别</button></div><p class="muted">本地读取不调用模型。视觉只读取识别结果，不上传摄像头画面。</p></div>
      <div class="card"><h3>单步测试</h3><label for="robot-test-kind">动作</label><select id="robot-test-kind"><option value="move">直行（1–200 mm）</option><option value="turn">右转（1–90°）</option></select><div class="robot-fields"><label>距离 / 角度<input id="robot-amount" type="number" min="1" max="200" value="50"></label><label>速度 %<input id="robot-speed" type="number" min="10" max="30" value="20"></label></div><button id="robot-test" class="wide">执行本次测试</button><p class="muted">确认场地空旷后点击。测试超时会尝试停止；网络停止请求不能替代实体停止操作。</p></div>
      <div id="robot-proposal" class="card" hidden><h3>AI 提出的测试</h3><strong id="robot-proposal-label"></strong><p id="robot-proposal-explanation"></p><button id="robot-execute-proposal" class="wide">执行建议测试</button><p class="muted">建议尚未执行，2 分钟内有效。</p></div>
      <div class="card"><h3>本次结果</h3><pre id="robot-result" class="robot-result"></pre><button id="robot-analyze" class="primary wide" data-command="robotAnalyze">让 AI 分析结果</button><p class="muted">点击后发送结果摘要与当前程序，可能产生模型费用。独立动作测试不证明学生程序整体正确。</p></div>
    </section>
  </main><script nonce="${nonce}" src="${script}"></script></body></html>`;
}

export function deactivate() {}
