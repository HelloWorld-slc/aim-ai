import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Conversations } from '../src/core/conversations';

async function fixture(run: (store: Conversations, root: string) => Promise<void>) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'aim-ai-chat-test-'));
  try { const store = new Conversations(root); await store.load(); await run(store, root); }
  finally { await fs.rm(root, { recursive: true, force: true }); }
}
test('new conversations preserve older messages across fresh store instances', () => fixture(async (store, root) => {
  const first = await store.create('走正方形', 'file:///one.py', 'AIM One');
  await store.append(first.id, 'user', '边长设为100毫米');
  await store.append(first.id, 'assistant', '建议程序副本', '已建议边长100毫米，以当前文件为准');
  const second = await store.create('识别足球', 'file:///two.py', 'AIM Two');
  await store.append(second.id, 'user', '找球');
  await store.select(first.id);
  const restarted = new Conversations(root); await restarted.load();
  assert.equal(restarted.activeId, first.id);
  assert.equal(restarted.list().length, 2);
  assert.equal(restarted.get(first.id).messages[0].text, '边长设为100毫米');
  assert.equal(restarted.context(first.id)[1].content, '已建议边长100毫米，以当前文件为准');
  assert.equal(restarted.get(second.id).projectUri, 'file:///two.py');
  assert.equal((await fs.readdir(root)).filter(n => n.endsWith('.tmp')).length, 0);
  await restarted.select();
  const blank = new Conversations(root); await blank.load();
  assert.equal(blank.activeId, undefined); assert.equal(blank.list().length, 2);
}));
test('concurrent appends retain every message, rename and delete affect only the chosen chat', () => fixture(async (store, root) => {
  const a = await store.create('A', 'file:///a.py', 'A'); const b = await store.create('B', 'file:///b.py', 'B');
  await Promise.all(Array.from({ length: 20 }, (_, i) => store.append(a.id, 'user', `message-${i}`)));
  assert.equal(store.get(a.id).messages.length, 20);
  await store.rename(a.id, '新名称'); await store.remove(b.id);
  const restarted = new Conversations(root); await restarted.load();
  assert.equal(restarted.get(a.id).title, '新名称'); assert.equal(restarted.list().length, 1);
  await assert.rejects(() => store.remove('../outside')); assert.throws(() => store.get('../outside'));
}));
test('context is bounded while full history stays on disk; broken files remain recoverable', () => fixture(async (store, root) => {
  const c = await store.create('Long chat', 'file:///a.py', 'A');
  for (let i = 0; i < 12; i++) { await store.append(c.id, 'user', `question-${i}`); await store.append(c.id, 'assistant', 'answer '.repeat(1200)); }
  assert.equal(store.get(c.id).messages.length, 24);
  const recent = store.context(c.id); assert.ok(recent.length <= 6); assert.ok(recent.reduce((n, m) => n + m.content.length, 0) <= 16000);
  await fs.writeFile(path.join(root, '11111111-1111-4111-8111-111111111111.json'), '{broken');
  const restarted = new Conversations(root); await restarted.load();
  assert.equal(restarted.warnings.length, 1); assert.equal(restarted.get(c.id).messages.length, 24);
  assert.equal(await fs.readFile(path.join(root, '11111111-1111-4111-8111-111111111111.json'), 'utf8'), '{broken');
}));

test('stream checkpoints upsert one answer, restore model/thinking, and mark interrupted runs', () => fixture(async (store, root) => {
  const chat = await store.create('Stream', 'file:///a.py', 'A');
  await store.append(chat.id, 'user', 'hello');
  const message = { id: '11111111-1111-4111-8111-111111111111', at: new Date().toISOString(), role: 'assistant' as const, text: 'part', thinking: 'provider public thinking', model: 'actual-model', status: 'streaming' as const };
  await store.upsert(chat.id, message); await store.upsert(chat.id, { ...message, text: 'partial answer' });
  const restarted = new Conversations(root); await restarted.load();
  assert.equal(restarted.get(chat.id).messages.length, 2); const saved = restarted.get(chat.id).messages[1];
  assert.equal(saved.status, 'interrupted'); assert.equal(saved.model, 'actual-model'); assert.equal(saved.thinking, message.thinking);
  assert.equal(restarted.context(chat.id).length, 1);
  await store.upsert(chat.id, { ...message, status: 'complete', text: 'finished' });
  assert.deepEqual(store.context(chat.id)[1], { role: 'assistant', content: 'finished' });
}));
