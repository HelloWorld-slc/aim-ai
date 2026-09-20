// Optional UI smoke test: point AIM_AI_PLAYWRIGHT at an installed Playwright module.
// Uses a fresh, headless Edge profile and a mock VS Code bridge; no user browser data.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.AIM_AI_PLAYWRIGHT || 'playwright');
require('tsx/cjs');
const { PRESETS, thinkingOptions } = require('../src/core/presets.ts');

(async () => {
  const root = path.resolve(__dirname, '..');
  const source = await fs.readFile(path.join(root, 'src/extension.ts'), 'utf8');
  const template = source.match(/function html[\s\S]*?return `([\s\S]*?)`;/)[1];
  const topics = await Promise.all(JSON.parse(await fs.readFile(path.join(root, 'resources/knowledge/index.json'), 'utf8')).map(async t => ({ ...t, searchText: [t.title, ...t.keywords, await fs.readFile(path.join(root, 'resources/knowledge', t.file), 'utf8')].join('\n').toLowerCase() })));
  const chat = { id: 'fixture-chat', title: '走正方形', projectName: 'AIM Square', updatedAt: new Date().toISOString(), count: 2, messages: [{ role: 'user', text: '边长100毫米' }, { role: 'assistant', text: '已准备正方形程序。' }] };
  const state = { type: 'state', data: { model: 'deepseek-flash', provider: 'deepseek', endpoint: '', topics, hardware: false, autoExport: false, busy: false, activeId: chat.id, chats: [chat], thinking: { ...thinkingOptions('deepseek', 'deepseek-flash'), value: 'low' } } };
  const theme = ':root{--vscode-foreground:#dedede;--vscode-descriptionForeground:#a0a0a0;--vscode-panel-border:#393939;--vscode-editor-background:#1f1f1f;--vscode-sideBar-background:#181818;--vscode-font-family:Segoe UI,sans-serif;--vscode-button-secondaryBackground:#313131;--vscode-button-secondaryForeground:#dedede;--vscode-button-secondaryHoverBackground:#404040;--vscode-focusBorder:#48c9b0;--vscode-input-background:#292929;--vscode-input-foreground:#dedede}';
  let origin;
  const server = http.createServer(async (req, res) => {
    if (req.url === '/') {
      const html = template.replace(/\$\{nonce\}/g, 'ui-fixture').replace(/\$\{csp\}/g, origin).replace(/\$\{script\}/g, origin + '/main.js').replace(/\$\{style\}/g, origin + '/style.css');
      res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html);
    } else if (req.url === '/main.js' || req.url === '/style.css') {
      const css = req.url.endsWith('.css');
      res.setHeader('Content-Type', css ? 'text/css' : 'text/javascript');
      res.end((css ? theme : '') + await fs.readFile(path.join(root, 'media', css ? 'style.css' : 'webview.js'), 'utf8'));
    } else if (PRESETS.some(p => req.url === '/providers/' + p.icon)) {
      res.setHeader('Content-Type', req.url.endsWith('.jpg') ? 'image/jpeg' : req.url.endsWith('.ico') ? 'image/x-icon' : 'image/png');
      res.end(await fs.readFile(path.join(root, 'media', req.url.slice(1))));
    } else { res.statusCode = 404; res.end(); }
  });
  let browser;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${server.address().port}`;
    state.data.providers = PRESETS.map(p => ({ ...p, icon: origin + '/providers/' + p.icon }));
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 360, height: 900 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => { window.sent = []; window.acquireVsCodeApi = () => ({ getState: () => ({}), setState: s => window.persisted = s, postMessage: message => window.sent.push(message) }); });
    await page.goto(origin); await page.evaluate(s => window.postMessage(s, '*'), state);
    await page.evaluate(c => window.postMessage({ type: 'conversation', data: { activeId: c.id, chats: [c], current: c } }, '*'), chat);
    assert.equal(await page.locator('.message').count(), 2);
    const rich = { id: 'rich-answer', role: 'assistant', text: '## 正方形程序\n\n**边长**设为 100 mm，完成后停止。\n\n- 前进\n- 右转\n\n| 参数 | 数值 |\n| --- | --- |\n| 速度 | 20% |\n\n```python\nfor step in range(4):\n    robot.move_for(100, 0)\n```\n\n[官方资料](https://api.vex.com/aim/home/)\n\n<script>window.attacked=true</script>\n[危险命令](command:evil)\n![远程图像](https://invalid.example/track.png)', thinking: '**已返回的思考**：先核对运动单位和停止条件。', model: 'deepseek-v4.1-flash', status: 'streaming', phase: '正在回答', startedAt: Date.now() };
    await page.evaluate(data => window.postMessage({ type: 'chatMessage', data }, '*'), rich);
    const richCard = page.locator('.message').last();
    await richCard.locator('h2').waitFor();
    assert.equal(await richCard.locator('h2').textContent(), '正方形程序');
    assert.equal(await richCard.locator('table').count(), 1); assert.ok(await richCard.locator('pre code .hljs-keyword').count() >= 2);
    assert.equal(await richCard.locator('.message-label').textContent(), 'deepseek-v4.1-flash');
    assert.equal(await richCard.locator('.thinking-content').getAttribute('open'), '');
    assert.equal(await richCard.locator('script, img, a[href^="command:"]').count(), 0);
    assert.equal(await page.evaluate(() => window.attacked), undefined);
    await richCard.locator('.copy-code').click(); assert.ok(await page.evaluate(() => window.sent.some(m => m.type === 'copyCode' && m.text.includes('robot.move_for'))));
    await richCard.locator('a[href^="https://api.vex.com"]').click(); assert.ok(await page.evaluate(() => window.sent.some(m => m.type === 'openLink' && m.url === 'https://api.vex.com/aim/home/')));
    await page.evaluate(data => window.postMessage({ type: 'chatMessage', data: { ...data, status: 'complete', phase: '已完成' } }, '*'), rich);
    assert.equal(await page.locator('.message').count(), 3);
    await page.evaluate(() => window.postMessage({ type: 'proposal', data: { explanation: '边长修改为 100 mm，保留配置。', changes: { added: 4, removed: 2 } } }, '*'));
    assert.equal(await page.locator('#diff-added').textContent(), '+4 行新增'); assert.equal(await page.locator('#diff-removed').textContent(), '−2 行删除');
    await fs.mkdir(path.join(root, 'test-results'), { recursive: true });
    await page.evaluate(data => window.postMessage({ type: 'chatMessage', data: { ...data, text: data.text.split('<script>')[0], status: 'complete', phase: '已完成' } }, '*'), rich);
    await page.setViewportSize({ width: 380, height: 1200 });
    await page.locator('.message-label').last().scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(root, 'test-results', 'rich-chat.png'), fullPage: true });
    await page.setViewportSize({ width: 360, height: 900 });
    await page.evaluate(c => window.postMessage({ type: 'conversation', data: { activeId: c.id, chats: [c], current: c } }, '*'), chat);
    await page.locator('#thinking-effort').selectOption('high');
    assert.ok(await page.evaluate(() => window.sent.some(m => m.type === 'thinking' && m.value === 'high')));
    await page.locator('#prompt').fill('旧对话的草稿');
    await page.locator('nav [data-tab="models"]').click();
    await page.waitForFunction(() => [...document.querySelectorAll('.provider-select img')].length === 7 && [...document.querySelectorAll('.provider-select img')].every(i => i.complete && i.naturalWidth > 0));
    assert.equal(await page.locator('.provider-card').count(), 7);
    await page.locator('[data-provider="kimi"]').click();
    assert.ok(await page.evaluate(() => window.sent.some(m => m.type === 'configureProvider' && m.id === 'kimi')));
    await fs.mkdir(path.join(root, 'test-results'), { recursive: true });
    await page.screenshot({ path: path.join(root, 'test-results', 'models.png'), fullPage: true });
    await page.locator('nav [data-tab="history"]').click();
    assert.equal(await page.locator('.chat-card').count(), 1);
    await page.locator('[data-rename-chat]').click(); await page.locator('[data-delete-chat]').click();
    assert.ok(await page.evaluate(() => ['renameChat', 'deleteChat'].every(type => window.sent.some(m => m.type === type && m.id === 'fixture-chat'))));
    await page.locator('#chat-search').fill('notfound'); assert.equal(await page.locator('.chat-card').count(), 0);
    await page.locator('#chat-search').fill('');
    await page.screenshot({ path: path.join(root, 'test-results', 'history.png'), fullPage: true });
    await page.locator('#history [data-action="clear"]').click();
    assert.ok(await page.evaluate(() => window.sent.some(m => m.type === 'clear')));
    await page.evaluate(c => window.postMessage({ type: 'conversation', data: { chats: [c] } }, '*'), chat);
    assert.equal(await page.locator('#prompt').inputValue(), '');
    await page.locator('#prompt').fill('新对话的草稿');
    await page.locator('nav [data-tab="history"]').click(); await page.locator('[data-open-chat]').click();
    await page.evaluate(c => window.postMessage({ type: 'conversation', data: { activeId: c.id, chats: [c], current: c } }, '*'), chat);
    assert.equal(await page.locator('#prompt').inputValue(), '旧对话的草稿');
    assert.equal(await page.locator('.message').count(), 2);
    assert.equal(await page.evaluate(() => window.persisted.drafts.new), '新对话的草稿');
    await page.evaluate(() => window.postMessage({ type: 'busy', data: true }, '*'));
    assert.equal(await page.locator('#thinking-effort').isDisabled(), true);
    await page.evaluate(() => window.postMessage({ type: 'busy', data: false }, '*'));
    await page.locator('nav [data-tab="project"]').click(); await page.locator('#open-after-export').uncheck();
    assert.ok(await page.evaluate(() => window.sent.some(m => m.type === 'openAfterExport' && m.value === false)));
    await page.locator('[data-tab="docs"]').click();
    await page.waitForFunction(() => document.getElementById('topic-count').textContent.includes('31'));
    assert.equal(await page.locator('.topic:visible').count(), 19);
    await page.locator('.topic-branch summary').click();
    await page.locator('[data-topic="timer"]').waitFor({ state: 'visible' });
    assert.equal(await page.locator('.topic:visible').count(), 31);
    const search = page.locator('#topic-search');
    for (const [query, id] of [['线程', 'threads'], ['draw_rectangle', 'screen'], ['robot.screen.draw_rectangle()', 'screen'], ['timer.event', 'timer']]) {
      await search.fill(query); await page.locator(`[data-topic="${id}"]`).waitFor({ state: 'visible' });
    }
    await page.locator('[data-topic="timer"]').click();
    assert.ok(await page.evaluate(() => window.sent.some(m => m.type === 'topic' && m.id === 'timer')));
    await page.evaluate(s => window.postMessage(s, '*'), state);
    assert.equal(await search.inputValue(), 'timer.event');
    await search.fill('zzzz_no_reference');
    assert.equal(await page.locator('.topic').count(), 0);
    assert.match(await page.locator('#topics').textContent(), /没有找到/);
    await search.fill('');
    assert.equal(await page.locator('.topic:visible').count(), 31);
    await fs.mkdir(path.join(root, 'test-results'), { recursive: true });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(root, 'test-results', 'references.png'), fullPage: true });
    await page.setViewportSize({ width: 240, height: 900 });
    for (const tab of ['chat', 'history', 'models', 'project', 'docs']) {
      await page.locator(`nav [data-tab="${tab}"]`).click();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), tab + ' 240px layout');
    }
    await page.locator('nav [data-tab="chat"]').click();
    await page.evaluate(data => window.postMessage({ type: 'chatMessage', data: { ...data, status: 'interrupted', phase: '已中断 · 保留已接收内容' } }, '*'), rich);
    assert.equal(await page.locator('.message').count(), 3);
    assert.match(await page.locator('.message-status').last().textContent(), /已中断/);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.deepEqual(errors, []);
    await fs.writeFile(path.join(root, 'test-results', 'webview.json'), JSON.stringify({ at: new Date().toISOString(), passed: true, checks: ['Markdown headings/tables/highlight/copy/links', 'script/command/image injection blocked', 'thinking and actual model', 'stream upsert and interrupted status', 'diff counts', 'seven official icons loaded', 'provider configuration', 'thinking selection and busy lock', 'history search/open/rename/delete/new chat', 'per-chat draft restoration', 'export open toggle', '31 entries render', 'Logic expansion', 'Chinese and API search', 'reference click', 'search survives state refresh', 'empty results', 'expansion restored', 'all five tabs at 240px', 'no script errors'] }, null, 2));
    console.log('Webview smoke test passed.');
  } finally {
    if (browser) await browser.close();
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
