const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const vscode = require('vscode');

exports.run = async function () {
  const extensionRoot = path.resolve(__dirname, '..');
  const results = [];
  const report = (name) => results.push({ name, passed: true });
  let server;
  let readReferenceTest = false;
  let referenceId = 'timer';
  let referenceReply;
  let referenceIndex;
  let streamMode = '';
  let robotMode = '';
  let robotCalls = 0;
  let robotReply = '';
  let robotToolNames = [];
  try {
    const ext = vscode.extensions.getExtension('aim-ai-local.aim-ai');
    assert.ok(ext, 'development extension registered');
    const api = await ext.activate();
    assert.ok(api.assistant); report('extension activation');
    if (process.env.AIM_AI_HISTORY_VERIFY === '1') {
      const expected = JSON.parse(await fs.readFile(path.join(extensionRoot, '.vscode-test', 'restart-expected.json'), 'utf8'));
      const restored = api.assistant.conversationState();
      assert.equal(restored.activeId, expected.id);
      assert.equal(restored.current.messages.length, expected.count);
      assert.ok(restored.current.messages.some(m => m.text.includes('边长')));
      assert.equal(api.assistant.proposal, undefined);
      assert.equal(api.assistant.thinkingState().value, 'high');
      assert.ok(restored.current.messages.some(m => m.model === 'deepseek-v4.1-flash' && m.thinking?.includes('核对单位')));
      await fs.writeFile(path.join(extensionRoot, 'test-results', 'restart.json'), JSON.stringify({ at: new Date().toISOString(), passed: true, messages: expected.count, pendingProposalRestored: false }, null, 2));
      return;
    }
    await api.assistant.clear();
    const registered = await vscode.commands.getCommands(true);
    for (const name of ['open', 'configure', 'importProject', 'exportProject', 'check', 'restore', 'stop']) assert.ok(registered.includes(`aimAI.${name}`));
    report('commands registered');
    const project = await api.projects.current();
    const doc = await vscode.workspace.openTextDocument(project.main);
    await vscode.window.showTextDocument(doc);
    const initial = doc.getText();
    const messages = [];
    const originalEmitter = api.assistant.onMessage;
    api.assistant.onMessage = (type, data) => messages.push({ type, data });
    assert.equal(await api.assistant.check(), true); report('syntax checker in extension host');

    const config = vscode.workspace.getConfiguration('aimAI');
    await config.update('robotAutoConnect', false, vscode.ConfigurationTarget.Global);
    await config.update('provider', 'custom', vscode.ConfigurationTarget.Global);
    await config.update('protocol', 'chat-completions', vscode.ConfigurationTarget.Global);
    await api.assistant.setThinking('high');
    assert.equal((await api.assistant.configuration().catch(() => ({ thinkingEffort: 'not-configured' }))).thinkingEffort === 'not-configured' || api.assistant.thinkingState().value === 'high', true);
    await assert.rejects(() => api.assistant.setThinking('invalid-option'), /不支持/);
    server = http.createServer(async (req, res) => {
      let body = ''; for await (const chunk of req) body += chunk;
      const input = JSON.parse(body);
      robotToolNames = (input.tools || []).map(t => t.function.name);
      assert.equal(input.reasoning_effort, 'high');
      if (input.messages[0].content.includes('connection test')) {
        res.end(JSON.stringify({ choices: [{ message: { content: 'OK' } }] })); return;
      }
      if (robotMode) {
        robotCalls++;
        if (robotMode.startsWith('batch') && (input.messages.at(-1).role !== 'tool' || robotMode === 'batch-flood')) {
          res.end(JSON.stringify({ choices: [{ message: { content: null, tool_calls: [{ id: `batch-${robotCalls}`, type: 'function', function: { name: 'run_robot_batch', arguments: JSON.stringify({ steps: [{ kind: 'move', amount: 20, speed: 20 }, { kind: 'move', amount: 20, speed: 20, direction: 'backward' }], fields: ['positionMm'] }) } }] } }] })); return;
        }
        if (robotMode === 'ordinary') { res.end(JSON.stringify({ choices: [{ message: { content: '普通代码解释，不读取机器人。' } }] })); return; }
        if (robotMode === 'proposal') {
          res.end(JSON.stringify({ choices: [{ message: { content: null, tool_calls: [{ id: 'robot-plan', type: 'function', function: { name: 'propose_robot_test', arguments: JSON.stringify({ kind: 'move', amount: 50, speed: 20, explanation: '测试一次短距离直行。' }) } }] } }] })); return;
        }
        if (input.messages.at(-1).role === 'tool' && robotMode !== 'flood') {
          robotReply = input.messages.at(-1).content;
          res.end(JSON.stringify({ choices: [{ message: { content: '已收到模拟状态，未验证实机。' } }] })); return;
        }
        res.end(JSON.stringify({ choices: [{ message: { content: null, tool_calls: [{ id: `robot-${robotCalls}`, type: 'function', function: { name: 'read_robot_snapshot', arguments: JSON.stringify({ include_vision: true }) } }] } }] })); return;
      }
      if (streamMode) {
        assert.equal(input.stream, true);
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        const frame = (delta, finish_reason = null) => `data: ${JSON.stringify({ model: 'deepseek-v4.1-flash', choices: [{ index: 0, delta, finish_reason }] })}\n\n`;
        res.write(frame({ reasoning_content: '先核对单位，再检查边长。' }));
        if (streamMode === 'cutoff') { res.end(frame({ content: '这是一段未完成的回答' })); return; }
        const current = input.messages.at(-1).content.match(/<current_source>\n([\s\S]*)\n<\/current_source>/)[1];
        const text = streamMode === 'code' ? `## 建议\n\n\`\`\`python\n${current.replace('SIDE_LENGTH_MM = 100', 'SIDE_LENGTH_MM = 160')}\`\`\`` : '## 已检查\n\n**边长**没有修改。';
        setTimeout(() => res.end(frame({ content: text }, 'stop') + 'data: [DONE]\n\n'), 110);
        return;
      }
      if (readReferenceTest) {
        referenceIndex = input.messages[0].content;
        if (input.messages.at(-1).role === 'tool') {
          referenceReply = input.messages.at(-1).content;
          res.end(JSON.stringify({ choices: [{ message: { content: '已读取所需资料。' } }] }));
        } else {
          res.end(JSON.stringify({ choices: [{ message: { content: null, tool_calls: [{ id: 'ref-call', type: 'function', function: { name: 'read_reference', arguments: JSON.stringify({ id: referenceId }) } }] } }] }));
        }
        return;
      }
      assert.ok(input.messages[0].content.includes('AIM'));
      const current = input.messages.at(-1).content.match(/<current_source>\n([\s\S]*)\n<\/current_source>/)[1];
      const source = current.replace('SIDE_LENGTH_MM = 100', 'SIDE_LENGTH_MM = 140');
      res.end(JSON.stringify({ choices: [{ message: { content: null, tool_calls: [{ id: 'test-call', type: 'function', function: { name: 'propose_program', arguments: JSON.stringify({ source, explanation: '把测试边长改为140毫米；未运行机器人。' }) } }] } }], usage: { total_tokens: 42 } }));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    await config.update('baseUrl', `http://127.0.0.1:${server.address().port}/v1`, vscode.ConfigurationTarget.Global);
    await config.update('model', 'local-fixture', vscode.ConfigurationTarget.Global);
    await config.update('streamResponses', true, vscode.ConfigurationTarget.Global);
    assert.equal((await api.assistant.configuration()).thinkingEffort, 'high'); report('thinking selection saved and passed to API, invalid option rejected');
    await api.assistant.test(); report('connection test against local mock only');

    await api.assistant.send('把正方形边长改为140毫米');
    assert.ok(api.assistant.proposal); assert.equal(doc.getText(), initial); report('AI proposal does not modify source');
    assert.deepEqual(api.assistant.proposal.changes, { added: 1, removed: 1 });
    const autoDiff = vscode.window.tabGroups.all.flatMap(g => g.tabs).find(t => t.input instanceof vscode.TabInputTextDiff && t.input.modified.scheme === 'aim-ai-preview');
    assert.ok(autoDiff, 'automatic code review opens before clicking preview');
    assert.equal((await vscode.workspace.openTextDocument(autoDiff.input.original)).getText(), initial);
    report('code review opens automatically with immutable old/new snapshots and line counts');
    await api.assistant.preview(); report('native diff editor opens');
    await api.assistant.apply();
    assert.ok(doc.getText().includes('SIDE_LENGTH_MM = 140')); assert.equal(doc.isDirty, true); report('WorkspaceEdit updates unsaved buffer');
    await api.assistant.restore(); assert.equal(doc.getText(), initial); report('restore previous version');

    await api.assistant.send('再次修改边长');
    const edit = new vscode.WorkspaceEdit(); edit.insert(doc.uri, doc.positionAt(doc.getText().length), '\n# student edit\n');
    await vscode.workspace.applyEdit(edit);
    await assert.rejects(() => api.assistant.apply(), /发生修改/); report('concurrent student edit is preserved');
    assert.ok(doc.getText().includes('# student edit'));
    await doc.save();
    await api.exportProject(true);
    const exported = JSON.parse(await fs.readFile(path.join(project.root, 'dist', `${project.name}.aimpython`), 'utf8'));
    assert.equal(exported.textContent, doc.getText()); report('export uses latest editor source');
    assert.equal(exported.slot, project.slot - 1); report('official project slot conversion');
    await config.update('autoExport', true, vscode.ConfigurationTarget.Workspace);
    for (let i = 0; i < 2; i++) {
      const savedEdit = new vscode.WorkspaceEdit();
      savedEdit.insert(doc.uri, doc.positionAt(doc.getText().length), `# saved edit ${i}\n`);
      await vscode.workspace.applyEdit(savedEdit); await doc.save();
    }
    const exportFile = path.join(project.root, 'dist', `${project.name}.aimpython`);
    let latest;
    for (let i = 0; i < 50; i++) {
      latest = JSON.parse(await fs.readFile(exportFile, 'utf8')).textContent;
      if (latest === doc.getText()) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.equal(latest, doc.getText()); report('consecutive saves auto-export newest source');
    await config.update('autoExport', false, vscode.ConfigurationTarget.Workspace);
    await vscode.commands.executeCommand('aimAI.open'); report('sidebar webview created');
    const context = await api.knowledge.context('足球视觉'); assert.ok(context.ids.includes('vision')); report('bundled reference retrieval');
    const catalog = api.knowledge.catalog();
    assert.equal(catalog.length, 44); assert.equal(catalog.filter(t => t.parent === 'logic').length, 12);
    assert.equal(catalog.filter(t => t.parent === 'vision-guide').length, 11);
    assert.ok((await api.knowledge.context('光照和地面反光')).ids.includes('vision-environment'));
    assert.ok(catalog.find(t => t.id === 'screen').searchText.includes('draw_rectangle'));
    report('complete Python catalog available in extension host');
    readReferenceTest = true;
    const beforeReference = doc.getText();
    await api.assistant.send('读取 Timer 资料，解释延迟回调，不修改程序');
    assert.ok(referenceIndex.includes('"id":"threads"'));
    assert.ok(referenceReply.includes('Logic/Timer.html'));
    assert.ok(referenceReply.includes('timer.event'));
    assert.ok(messages.some(m => m.type === 'reference' && m.data === 'timer'));
    assert.equal(doc.getText(), beforeReference);
    report('model tool can read a new Logic reference without editing code');
    referenceId = 'vision-errors';
    await api.assistant.send('查阅识别不到球和目标丢失的资料，只解释，不修改程序');
    assert.ok(referenceIndex.includes('"id":"vision-guide"'));
    assert.ok(referenceReply.includes('漏检、误识别与目标丢失'));
    assert.ok(referenceReply.includes('https://education.vex.com/'));
    assert.ok(messages.some(m => m.type === 'reference' && m.data === 'vision-errors'));
    assert.equal(doc.getText(), beforeReference);
    report('model tool reads the vision course reference and returns its source without editing code');
    streamMode = 'text';
    await api.assistant.send('流式解释边长，不修改程序');
    const received = api.assistant.conversationState().current.messages.at(-1);
    assert.equal(received.model, 'deepseek-v4.1-flash'); assert.match(received.thinking, /核对单位/); assert.equal(received.status, 'complete');
    assert.ok(messages.some(m => m.type === 'chatMessage' && m.data.status === 'streaming' && m.data.thinking?.includes('核对单位')));
    report('streamed thinking and answer arrive live and persist with actual model name');
    streamMode = 'code'; await api.assistant.send('请在代码块给出完整程序');
    assert.ok(api.assistant.proposal); assert.equal(doc.getText(), beforeReference);
    assert.deepEqual(api.assistant.proposal.changes, { added: 1, removed: 1 });
    report('full Python code fence triggers checked review without modifying source');
    streamMode = 'cutoff'; await assert.rejects(() => api.assistant.send('模拟中途断开'), /提前结束/);
    assert.equal(api.assistant.proposal, undefined);
    assert.ok(api.assistant.conversationState().current.messages.some(m => m.status === 'interrupted' && m.text.includes('未完成')));
    report('stream interruption preserves partial content and offers no executable proposal');
    streamMode = '';
    const firstChat = api.assistant.conversationState().current;
    assert.ok(firstChat.messages.some(m => m.text.includes('建议程序')));
    const countBeforeNew = api.assistant.conversations.list().length;
    await api.assistant.clear();
    assert.equal(api.assistant.conversationState().activeId, undefined);
    assert.equal(api.assistant.conversations.list().length, countBeforeNew);
    await api.assistant.send('这是另一个关于计时器的新对话');
    assert.notEqual(api.assistant.conversationState().activeId, firstChat.id);
    await api.assistant.openConversation(firstChat.id);
    assert.equal(api.assistant.proposal, undefined);
    await api.assistant.send('继续上次的边长问题，读取计时器参考');
    const resumed = api.assistant.conversationState().current;
    assert.ok(resumed.messages.length > firstChat.messages.length);
    assert.equal(doc.getText(), beforeReference);
    report('new chat preserves old conversation and reopening permits continuation');
    // Install into this test host's isolated storage, then test AI automatic connection.
    await api.robot.disconnect();
    await api.robot.install();
    assert.equal(api.robot.state().installed, true); report('one-click robot dependency installer in isolated VS Code storage');
    await api.robot.saveConnection('', true);
    await config.update('robotAutoConnect', true, vscode.ConfigurationTarget.Global);
    robotMode = 'ordinary'; robotCalls = 0;
    await api.assistant.send('解释当前程序，不需要机器人状态');
    assert.equal(api.robot.state().connected, false); report('automatic connection waits for an actual robot tool call');
    robotMode = 'snapshot';
    await api.assistant.send('读取机器人状态并解释');
    assert.equal(api.robot.state().connected, true); assert.match(robotReply, /simulation/); assert.match(robotReply, /不证明当前学生程序/); report('AI connects without an approval dialog on first read and preserves simulation provenance');
    robotMode = 'proposal';
    await api.assistant.send('提出一个50毫米测试');
    assert.ok(api.robot.state().proposal); assert.equal(api.robot.state().snapshot.positionMm.y, 0); report('AI test proposal cannot directly cause movement');
    await api.robot.executeProposal(api.robot.state().proposal.id);
    assert.equal(api.robot.state().report.measured.positionDeltaMm, 50); assert.match(api.robot.analysisPrompt(), /模拟数据/); report('explicit proposal execution creates bounded summary for later AI analysis');
    robotMode = 'flood'; robotCalls = 0;
    const originalRead = api.robot.read.bind(api.robot); let reads = 0;
    api.robot.read = async (...args) => { reads++; return originalRead(...args); };
    await api.assistant.send('重复读取机器人状态');
    assert.equal(robotCalls, 3); assert.equal(reads, 2); assert.equal(api.robot.state().report, undefined); assert.equal(api.robot.state().snapshot.positionMm.y, 50); report('robot assist limits model rounds and actual state reads; latest snapshot replaces old report');
    api.robot.read = originalRead;
    await api.robot.disconnect();
    const originalConnect = api.robot.ensureForAI.bind(api.robot); let attempts = 0;
    api.robot.ensureForAI = async () => { attempts++; throw new Error('simulated connection failure'); };
    robotCalls = 0; await api.assistant.send('连接失败时不要无限重试');
    assert.equal(attempts, 1); assert.equal(robotCalls, 3); report('failed auto connection is attempted only once per task');
    robotMode = 'snapshot'; robotCalls = 0; attempts = 0;
    await api.assistant.send('连接不可用时继续给我代码建议');
    assert.equal(robotCalls, 2); assert.equal(attempts, 1); assert.match(robotReply, /simulated connection failure/); report('MCP connection error returns to model for a normal follow-up answer');
    api.robot.ensureForAI = originalConnect;
    robotMode = 'ordinary';
    await api.assistant.send('只讲解程序，不使用MCP', true, true, true);
    assert.equal(api.robot.state().connected, false); assert.ok(!robotToolNames.includes('read_robot_snapshot')); assert.ok(!robotToolNames.includes('run_robot_batch')); report('explicit no-MCP option overrides auto connection and motion authorization');
    const runtimeInstalled = api.robot.installed;
    api.robot.installed = false;
    await api.assistant.send('环境未安装也能问答', true, true);
    assert.ok(robotToolNames.includes('propose_program')); assert.ok(!robotToolNames.includes('read_robot_snapshot')); report('missing MCP runtime degrades to normal coding without blocking chat');
    api.robot.installed = runtimeInstalled;
    robotMode = 'batch'; robotCalls = 0;
    await api.assistant.send('执行一批前进和后退，比较位移', false, true);
    assert.equal(robotCalls, 2); assert.ok(robotToolNames.includes('run_robot_batch'));
    const batchReply = robotReply.slice(robotReply.indexOf('{'));
    assert.equal(JSON.parse(batchReply).completedSteps, 2); assert.equal(JSON.parse(batchReply).status, 'completed');
    assert.equal(JSON.parse(batchReply).after.batteryPercent, undefined);
    assert.equal(api.robot.state().report.net.displacementMm, 0); report('authorized AI batch executes once and returns selected telemetry for analysis in two requests');
    assert.ok(api.assistant.conversationState().current.messages.some(m => m.text.includes('自主调试结果'))); report('batch results persist in conversation history');
    const beforeDenied = await api.robot.read(false);
    robotCalls = 0;
    await api.assistant.send('本轮没有勾选自主运动');
    assert.ok(!robotToolNames.includes('run_robot_batch')); assert.match(robotReply, /不支持的工具/);
    assert.equal((await api.robot.read(false)).positionMm.y, beforeDenied.positionMm.y); report('motion permission expires each turn and an unadvertised tool call cannot execute');
    robotMode = 'batch-flood'; robotCalls = 0;
    const originalBatch = api.robot.executeAutonomous.bind(api.robot); let batches = 0;
    api.robot.executeAutonomous = async (...args) => { batches++; return originalBatch(...args); };
    await api.assistant.send('只做一批，禁止重复动作', false, true);
    assert.equal(batches, 1); assert.equal(robotCalls, 3); report('repeated model batch calls cannot exceed one batch per turn');
    let began;
    const startedBatch = new Promise(resolve => { began = resolve; });
    api.robot.executeAutonomous = (...args) => { began(); return originalBatch(...args); };
    robotMode = 'batch';
    const cancelTask = api.assistant.send('取消测试', false, true);
    const rejected = assert.rejects(cancelTask, /取消|中止|abort/i);
    await startedBatch;
    await new Promise(resolve => setTimeout(resolve, 80));
    api.assistant.cancel(); await rejected;
    await new Promise(resolve => setTimeout(resolve, 300));
    assert.equal((await api.robot.read(false)).stopped, true); report('chat cancellation propagates to MCP batch and stops the simulated robot');
    api.robot.executeAutonomous = originalBatch;
    await api.robot.disconnect();
    robotMode = 'ordinary';
    await api.assistant.send('断开后继续正常解释', false, false, true);
    assert.equal(api.robot.state().connected, false); report('ordinary chat continues after MCP disconnect and cancellation');
    await config.update('robotAutoConnect', false, vscode.ConfigurationTarget.Global);
    assert.equal(api.robot.canAutoConnect, false); report('automatic connection switch disables automatic tool access');
    robotMode = '';
    const finalChat = api.assistant.conversationState().current;
    await fs.writeFile(path.join(extensionRoot, '.vscode-test', 'restart-expected.json'), JSON.stringify({ id: finalChat.id, count: finalChat.messages.length }));
    await fs.mkdir(path.join(extensionRoot, 'test-results'), { recursive: true });
    await fs.writeFile(path.join(extensionRoot, 'test-results', 'integration.json'), JSON.stringify({ at: new Date().toISOString(), results, hardware: 'not tested', remoteModel: 'not tested' }, null, 2));
    if (process.env.AIM_AI_VISUAL === '1') {
      api.assistant.onMessage = originalEmitter;
      await api.assistant.clear();
      await config.update('baseUrl', '', vscode.ConfigurationTarget.Global);
      await config.update('model', '', vscode.ConfigurationTarget.Global);
      await new Promise(resolve => setTimeout(resolve, 180000));
    }
  } catch (error) {
    await fs.mkdir(path.join(extensionRoot, 'test-results'), { recursive: true });
    await fs.writeFile(path.join(extensionRoot, 'test-results', 'integration.json'), JSON.stringify({ results, failed: String(error), stack: error.stack }, null, 2));
    throw error;
  } finally {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  }
};
