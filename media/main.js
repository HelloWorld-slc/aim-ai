import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js/lib/core';
import python from 'highlight.js/lib/languages/python';
import json from 'highlight.js/lib/languages/json';
import diff from 'highlight.js/lib/languages/diff';
hljs.registerLanguage('python', python); hljs.registerLanguage('json', json); hljs.registerLanguage('diff', diff);
const markdown = new MarkdownIt({ html: false, linkify: false, breaks: true, highlight: (text, lang) => hljs.getLanguage(lang) ? hljs.highlight(text, { language: lang, ignoreIllegals: true }).value : '' });
markdown.disable('image');
const vscode = acquireVsCodeApi();
const el = id => document.getElementById(id);
const post = (type, data = {}) => vscode.postMessage({ type, ...data });
let busy = false;
let topics = [];
const expandedTopics = new Set();
let chats = [];
let activeChatId;
let hasConversation = false;
let currentModel = '';
let robotState = {};
let robotInitialized = false;
const messageNodes = new Map();
const welcomeTemplate = el('welcome').cloneNode(true);
const saved = vscode.getState();
const drafts = saved?.drafts || {};
if (saved?.draft) drafts.new = saved.draft;
const draftKey = () => activeChatId || 'new';
function saveDraft() { drafts[draftKey()] = el('prompt').value; vscode.setState({ drafts }); }
function showPage(id) {
  document.querySelectorAll('.tab').forEach(tab => tab.classList.toggle('active', tab.dataset.tab === id));
  document.querySelectorAll('.page').forEach(page => page.classList.toggle('active', page.id === id));
}
function renderChats() {
  const query = el('chat-search').value.trim().toLowerCase();
  const list = el('chat-list'); list.replaceChildren();
  el('chat-title').textContent = chats.find(c => c.id === activeChatId)?.title || '新对话';
  for (const chat of chats.filter(c => `${c.title} ${c.projectName}`.toLowerCase().includes(query))) {
    const card = document.createElement('div'); card.className = `chat-card${chat.id === activeChatId ? ' selected' : ''}`;
    const open = document.createElement('button'); open.className = 'chat-open'; open.dataset.openChat = chat.id; open.disabled = busy;
    const title = document.createElement('strong'); title.textContent = chat.title;
    const meta = document.createElement('small'); meta.textContent = `${chat.projectName} · ${new Date(chat.updatedAt).toLocaleString()} · ${chat.count} 条`;
    open.append(title, meta);
    const actions = document.createElement('div'); actions.className = 'chat-actions';
    for (const [action, label] of [['renameChat', '重命名'], ['deleteChat', '删除']]) { const b = document.createElement('button'); b.className = 'text-button'; b.dataset[action] = chat.id; b.textContent = label; b.disabled = busy; actions.append(b); }
    card.append(open, actions); list.append(card);
  }
  if (!list.children.length) { const empty = document.createElement('p'); empty.className = 'muted'; empty.textContent = query ? '没有找到匹配的对话。' : '发送第一条消息后，对话会自动保存在这里。'; list.append(empty); }
}
function renderConversation(data) {
  if (hasConversation) saveDraft();
  if (activeChatId !== data.activeId) el('robot-autonomous').checked = false;
  activeChatId = data.activeId; chats = data.chats || [];
  el('prompt').value = drafts[draftKey()] || ''; hasConversation = true;
  el('messages').replaceChildren(); messageNodes.clear(); setProposal(null);
  if (!data.current?.messages.length) el('messages').append(welcomeTemplate.cloneNode(true));
  else { for (const message of data.current.messages) add(message.role, message.text, false, message); el('messages').scrollTop = el('messages').scrollHeight; }
  renderChats();
}
function renderProviders(providers, selected) {
  el('providers').replaceChildren();
  for (const region of ['国内', '国外']) {
    const heading = document.createElement('h3'); heading.className = 'provider-region'; heading.textContent = region; el('providers').append(heading);
    for (const p of providers.filter(p => p.region === region)) {
      const card = document.createElement('div'); card.className = `provider-card${p.id === selected ? ' selected' : ''}`;
      const button = document.createElement('button'); button.className = 'provider-select'; button.dataset.provider = p.id; button.disabled = busy;
      const icon = document.createElement('img'); icon.src = p.icon; icon.alt = `${p.name} 官方标识`;
      const label = document.createElement('span'); label.textContent = p.name;
      const status = document.createElement('small'); status.textContent = p.id === selected ? '当前服务' : '配置 →'; button.append(icon, label, status);
      const note = document.createElement('p'); note.textContent = p.note;
      const docs = document.createElement('button'); docs.className = 'text-button'; docs.dataset.providerDocs = p.id; docs.textContent = '官方 API 文档 ↗';
      card.append(button, note, docs); el('providers').append(card);
    }
  }
}
el('chat-search').addEventListener('input', renderChats);
function topicButton(topic) {
  const button = document.createElement('button'); button.className = 'topic';
  button.dataset.topic = topic.id; button.textContent = `${topic.title}  ↗`;
  return button;
}
function renderTopics() {
  const terms = el('topic-search').value.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const matches = new Set(topics.filter(t => terms.every(term => {
    const name = term.replace(/\(.*$/, '').replace(/\.+$/, '');
    return t.searchText.includes(term) || (name.length > 0 && t.searchText.includes(name)) || (name.includes('.') && t.searchText.includes(name.slice(name.lastIndexOf('.') + 1)));
  })).map(t => t.id));
  const container = el('topics'); container.replaceChildren();
  el('topic-count').textContent = terms.length ? `找到 ${matches.size} / ${topics.length} 篇资料` : `共 ${topics.length} 篇资料 · 可展开 Logic 与图像识别子项`;
  for (const [group, label] of [['python', 'Python API'], ['guide', '项目与课堂']]) {
    const section = document.createElement('section'); section.className = 'topic-group';
    const heading = document.createElement('h3'); heading.textContent = label; section.append(heading);
    for (const topic of topics.filter(t => t.group === group && !t.parent)) {
      const children = topics.filter(t => t.parent === topic.id && matches.has(t.id));
      if (matches.has(topic.id)) section.append(topicButton(topic));
      if (children.length) {
        const branch = document.createElement('details'); branch.className = 'topic-branch';
        branch.open = terms.length > 0 || expandedTopics.has(topic.id);
        const summary = document.createElement('summary'); summary.textContent = `${topic.title} · ${children.length} 个子项`;
        branch.append(summary, ...children.map(topicButton));
        branch.addEventListener('toggle', () => { if (!terms.length && branch.isConnected) { if (branch.open) expandedTopics.add(topic.id); else expandedTopics.delete(topic.id); } });
        section.append(branch);
      }
    }
    if (section.children.length > 1) container.append(section);
  }
  if (!matches.size) { const message = document.createElement('p'); message.textContent = '没有找到资料，试试中文名称、英文分类或方法名。'; container.append(message); }
}
el('topic-search').addEventListener('input', renderTopics);
el('prompt').value = drafts.new || '';
el('prompt').addEventListener('input', saveDraft);
function send() {
  const prompt = el('prompt').value.trim();
  if (busy || !prompt) return;
  post('send', { prompt, robotDebug: el('robot-assist').checked, robotAutonomous: el('robot-autonomous').checked, robotDisabled: el('robot-disabled').checked });
  el('robot-autonomous').checked = false;
  el('prompt').value = ''; saveDraft();
}
function renderMarkdown(target, value) {
  target.innerHTML = DOMPurify.sanitize(markdown.render(value), { ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 's', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'span', 'hr', 'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td'], ALLOWED_ATTR: ['href', 'title', 'class'], ALLOW_DATA_ATTR: false });
  for (const link of target.querySelectorAll('a')) {
    try { if (!['https:', 'http:'].includes(new URL(link.getAttribute('href')).protocol)) link.removeAttribute('href'); }
    catch { link.removeAttribute('href'); }
  }
  for (const pre of target.querySelectorAll('pre')) {
    const code = pre.querySelector('code'); if (!code) continue;
    const copy = document.createElement('button'); copy.className = 'copy-code'; copy.textContent = '复制代码'; copy.type = 'button';
    copy.addEventListener('click', () => { post('copyCode', { text: code.textContent }); copy.textContent = '已请求复制'; }); pre.append(copy);
  }
}
function add(type, value, scroll = true, meta = {}) {
  const container = el('messages');
  const follow = container.scrollHeight - container.scrollTop - container.clientHeight < 70;
  el('welcome')?.remove();
  let nodes = meta.id ? messageNodes.get(meta.id) : undefined;
  if (meta.status === 'complete' && !value && !meta.thinking) { nodes?.item.remove(); messageNodes.delete(meta.id); return; }
  if (!nodes) {
    const item = document.createElement('article'); item.className = `message ${type}`;
    const title = document.createElement('strong'); title.className = 'message-label';
    const thought = document.createElement('details'); thought.className = 'thinking-content'; thought.hidden = true;
    const summary = document.createElement('summary'); const thinkingBody = document.createElement('div'); thinkingBody.className = 'markdown-body'; thought.append(summary, thinkingBody);
    const body = document.createElement('div'); body.className = 'message-body';
    const status = document.createElement('div'); status.className = 'message-status';
    item.append(title, thought, body, status); container.append(item);
    nodes = { item, title, thought, summary, thinkingBody, body, status, lastText: null, lastThinking: null };
    if (meta.id) messageNodes.set(meta.id, nodes);
  }
  nodes.title.textContent = type === 'user' ? '你' : type === 'assistant' ? (meta.model || (meta.at ? '模型（旧记录未保存名称）' : currentModel || '模型')) : '状态';
  if (value !== nodes.lastText) {
    if (type === 'assistant') { nodes.body.classList.add('markdown-body'); renderMarkdown(nodes.body, String(value)); }
    else nodes.body.textContent = String(value);
    nodes.lastText = value;
  }
  if (meta.thinking && meta.thinking !== nodes.lastThinking) {
    if (nodes.thought.hidden && meta.status === 'streaming') nodes.thought.open = true;
    nodes.thought.hidden = false; renderMarkdown(nodes.thinkingBody, meta.thinking); nodes.lastThinking = meta.thinking;
    nodes.summary.textContent = `思考内容 · ${meta.thinking.length} 字符`;
  }
  nodes.item.classList.toggle('streaming', meta.status === 'streaming');
  nodes.status.textContent = meta.phase || (meta.status === 'interrupted' ? '已中断 · 内容可能不完整' : meta.status === 'complete' ? '已完成' : '');
  nodes.status.dataset.started = meta.status === 'streaming' ? String(meta.startedAt || Date.now()) : '';
  nodes.status.dataset.phase = nodes.status.textContent;
  if (scroll && follow) container.scrollTop = container.scrollHeight;
}
setInterval(() => { for (const s of document.querySelectorAll('.message-status[data-started]')) if (s.dataset.started) s.textContent = `${s.dataset.phase} · ${Math.floor((Date.now() - Number(s.dataset.started)) / 1000)} 秒`; }, 1000);
function setBusy(value) {
  busy = value; el('send').disabled = busy; el('cancel').hidden = !busy;
  el('request-status').textContent = busy ? '正在处理…' : '';
  document.querySelectorAll('[data-action="clear"], [data-open-chat], [data-rename-chat], [data-delete-chat], [data-provider]').forEach(b => b.disabled = busy);
  el('thinking-effort').disabled = busy;
  el('stream-responses').disabled = busy;
  el('robot-assist').disabled = busy || !robotState.connected;
  renderRobot();
}
function renderRobot() {
  const r = robotState;
  el('robot-install').disabled = !!r.busy || !!r.connected;
  el('robot-install').textContent = r.installed ? '重新检查 / 安装环境' : '安装调试环境';
  el('robot-save').disabled = !!r.busy || !!r.connected;
  el('robot-auto-connect').checked = r.autoConnect !== false;
  el('robot-auto-connect').disabled = busy;
  el('robot-connect').disabled = !r.installed || !!r.busy || !!r.connected;
  el('robot-disconnect').disabled = !r.connected || !!r.busy;
  el('robot-stop').disabled = !r.connected && !r.busy;
  el('robot-host').disabled = !!r.busy || !!r.connected;
  el('robot-mode').disabled = !!r.busy || !!r.connected;
  if (!el('robot-host').value && r.host) el('robot-host').value = r.host;
  for (const id of ['robot-snapshot', 'robot-vision', 'robot-test']) el(id).disabled = !r.connected || !!r.busy;
  el('robot-analyze').disabled = busy || !!r.busy || !(r.snapshot || r.report);
  el('robot-assist').disabled = busy || el('robot-disabled').checked || !(r.connected || r.autoConfigured);
  el('robot-autonomous').disabled = busy || el('robot-disabled').checked || !(r.connected || r.autoConfigured);
  el('robot-disabled').disabled = busy;
  if (!(r.connected || r.autoConfigured)) el('robot-autonomous').checked = false;
  if (!r.connected && !r.autoConfigured) el('robot-assist').checked = false;
  if ((!robotInitialized || r.connected) && r.mode) { el('robot-mode').value = r.mode; robotInitialized = true; }
  el('robot-status').textContent = r.busy ? '正在处理…可点击停止 / 取消' : r.connected ? (r.mode === 'simulation' ? '模拟演示已连接 · 未连接实机' : `实机远程调试 · ${r.host}`) : r.installed ? '环境已准备好，尚未连接' : '首次使用需安装本地调试环境';
  el('robot-error').textContent = r.error || '';
  const value = r.report || r.snapshot;
  el('robot-result').textContent = value ? `${value.mode === 'simulation' ? '【模拟数据，不代表实机验证】' : '【实机远程调试结果】'}\n${JSON.stringify(value, null, 2)}` : '读取状态或执行测试后，结果显示在这里。';
  el('robot-proposal').hidden = !r.proposal;
  el('robot-proposal-label').textContent = r.proposal?.label || '';
  el('robot-proposal-explanation').textContent = r.proposal?.explanation || '';
  el('robot-execute-proposal').disabled = !r.connected || !!r.busy;
}
el('stream-responses').addEventListener('change', () => post('streamResponses', { value: el('stream-responses').checked }));
el('robot-disabled').addEventListener('change', () => {
  if (el('robot-disabled').checked) { el('robot-assist').checked = false; el('robot-autonomous').checked = false; }
  renderRobot();
});
el('thinking-effort').addEventListener('change', () => post('thinking', { value: el('thinking-effort').value }));
el('open-after-export').addEventListener('change', () => post('openAfterExport', { value: el('open-after-export').checked }));
el('robot-auto-connect').addEventListener('change', () => post('robotAutoConnect', { value: el('robot-auto-connect').checked }));
function setProposal(proposal) { el('proposal').hidden = !proposal; el('proposal-text').textContent = proposal?.explanation || ''; el('diff-added').textContent = proposal?.changes ? `+${proposal.changes.added} 行新增` : ''; el('diff-removed').textContent = proposal?.changes ? `−${proposal.changes.removed} 行删除` : ''; }
document.addEventListener('click', event => {
  const link = event.target.closest('.markdown-body a[href]');
  if (link) { event.preventDefault(); post('openLink', { url: link.getAttribute('href') }); return; }
  const button = event.target.closest('button'); if (!button) return;
  if (button.dataset.tab) {
    showPage(button.dataset.tab);
  } else if (button.id === 'robot-connect') post('robotConnect', { host: el('robot-host').value, simulate: el('robot-mode').value === 'simulation' });
  else if (button.id === 'robot-save') post('robotSaveConnection', { host: el('robot-host').value, simulate: el('robot-mode').value === 'simulation' });
  else if (button.id === 'robot-test') post('robotTest', { plan: { kind: el('robot-test-kind').value, amount: Number(el('robot-amount').value), speed: Number(el('robot-speed').value) } });
  else if (button.id === 'robot-execute-proposal') post('robotExecuteProposal', { id: robotState.proposal?.id });
  else if (button.dataset.provider) post('configureProvider', { id: button.dataset.provider });
  else if (button.dataset.providerDocs) post('providerDocs', { id: button.dataset.providerDocs });
  else if (button.dataset.openChat) { post('openChat', { id: button.dataset.openChat }); showPage('chat'); }
  else if (button.dataset.renameChat) post('renameChat', { id: button.dataset.renameChat });
  else if (button.dataset.deleteChat) post('deleteChat', { id: button.dataset.deleteChat });
  else if (button.dataset.command) post('command', { name: button.dataset.command });
  else if (button.dataset.topic) post('topic', { id: button.dataset.topic });
  else if (button.dataset.prompt) { el('prompt').value = button.dataset.prompt; el('prompt').focus(); }
  else if (button.dataset.action === 'send') send();
  else if (button.dataset.action === 'clear') { post('clear'); showPage('chat'); }
  else if (button.dataset.action) post(button.dataset.action);
});
el('prompt').addEventListener('keydown', event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); send(); } });
window.addEventListener('message', event => {
  const { type, data } = event.data;
  if (type === 'robotState') { robotState = data || {}; renderRobot(); return; }
  if (type === 'state') {
    currentModel = data.model;
    el('stream-responses').checked = data.streamResponses !== false;
    el('model-name').textContent = data.model; el('model').title = data.endpoint;
    setBusy(data.busy); setProposal(data.proposal);
    el('download').disabled = !data.hardware; el('run').disabled = !data.hardware;
    el('hardware-state').textContent = data.hardware ? '实验性硬件桥接已启用。设备结果仍须实机核验。' : '下载和运行尚未启用，等待连接实机验证。';
    el('auto-export').textContent = data.autoExport ? '自动导出已开启：保存时更新 dist 内的项目文件。' : '自动导出未开启，可在 AIM AI 设置中开启。';
    topics = data.topics; renderTopics();
    renderProviders(data.providers || [], data.provider);
    const thinking = data.thinking || { options: [{ value: 'default', label: '预设默认' }], value: 'default', note: '' };
    el('thinking-effort').replaceChildren(...thinking.options.map(o => { const option = document.createElement('option'); option.value = o.value; option.textContent = o.label; return option; }));
    el('thinking-effort').value = thinking.value;
    el('thinking-note').textContent = thinking.note;
    el('open-after-export').checked = data.openAfterExport !== false;
    const provider = (data.providers || []).find(p => p.id === data.provider);
    el('model-icon').hidden = !provider;
    if (provider) el('model-icon').src = provider.icon;
    chats = data.chats || []; activeChatId = data.activeId; renderChats();
  } else if (type === 'chatMessage') add('assistant', data.text, true, data);
  else if (['user', 'assistant', 'notice'].includes(type)) add(type, data);
  else if (type === 'conversation') renderConversation(data);
  else if (type === 'chatList') { chats = data.chats; activeChatId = data.activeId; renderChats(); }
  else if (type === 'busy') setBusy(data);
  else if (type === 'proposal') setProposal(data);
  else if (type === 'clear') { el('messages').replaceChildren(); setProposal(null); }
  else if (type === 'references') add('notice', `本次参考：${data.join(' · ')}`);
  else if (type === 'reference') add('notice', `已查阅：${data}`);
  else if (type === 'usage') add('notice', `服务商报告本次累计用量：${data} tokens`);
});
post('ready');
