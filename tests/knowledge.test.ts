import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { Knowledge, MAX_CONTEXT_CHARS } from '../src/knowledge';

const root = path.resolve('resources/knowledge');
async function library() { const knowledge = new Knowledge(root); await knowledge.load(); return knowledge; }

test('bundled references cover every official Python category and Logic child', async () => {
  const knowledge = await library();
  const categories = ['motion', 'emoji', 'kicker', 'sound', 'led', 'message', 'macro', 'vision', 'screen', 'controller', 'inertial', 'console', 'robot', 'logic', 'micropython'];
  const children = ['control', 'timer', 'variables', 'functions', 'events', 'math', 'random', 'operators', 'comments', 'colors', 'formatting', 'threads'];
  assert.deepEqual(knowledge.topics.filter(t => t.group === 'python' && t.id !== 'python' && !t.parent).map(t => t.id), categories);
  assert.deepEqual(knowledge.topics.filter(t => t.parent === 'logic').map(t => t.id), children);
  assert.equal(knowledge.topics.length, 31);
  for (const topic of knowledge.topics.filter(t => t.group === 'python')) {
    assert.ok(topic.source?.startsWith('https://api.vex.com/aim/home/python/'));
    const body = await knowledge.read(topic.id);
    assert.ok(body.includes(topic.source!));
    for (const link of body.matchAll(/\]\(([a-z-]+\.md)\)/g)) await fs.access(path.join(root, link[1]));
  }
  assert.equal((await knowledge.read('micropython')).match(/https:\/\/docs\.micropython\.org\/en\/v1\.22\.0\/library\//g)?.length, 14);
});

test('AI retrieves new topics from Chinese tasks and bare or qualified API names', async () => {
  const knowledge = await library();
  for (const [query, expected] of [
    ['显示表情', 'emoji'], ['摇杆遥控', 'controller'], ['碰撞加速度', 'inertial'],
    ['draw_rectangle', 'screen'], ['robot.screen.draw_rectangle()', 'screen'],
    ['timer.event', 'timer'], ['math.atan2', 'math'], ['Thread', 'threads'],
    ['random.getrandbits', 'random'], ['json', 'micropython'], ['broadcast_and_wait', 'events']
  ]) {
    const context = await knowledge.context(query);
    assert.ok(context.ids.includes(expected), `${query}: ${context.ids.join(', ')}`);
    assert.ok(context.ids.length <= 4);
    assert.ok(context.text.length <= MAX_CONTEXT_CHARS);
  }
  // English keyword "io" must not match the middle of "vision".
  assert.ok(!(await knowledge.context('vision')).ids.includes('micropython'));
  const broad = await knowledge.context(knowledge.topics.flatMap(t => t.keywords).join(' '));
  assert.ok(broad.text.length <= MAX_CONTEXT_CHARS); assert.ok(broad.ids.length <= 4);
  await assert.rejects(() => knowledge.read('../package.json'));
});

test('sidebar catalog includes nested pages and method-name searchable text', async () => {
  const knowledge = await library(); const catalog = knowledge.catalog();
  assert.equal(catalog.length, 31);
  assert.equal(catalog.find(t => t.id === 'timer')?.parent, 'logic');
  assert.ok(catalog.find(t => t.id === 'screen')?.searchText.includes('draw_rectangle'));
  assert.ok(catalog.find(t => t.id === 'threads')?.searchText.includes('线程'));
  assert.ok(catalog.every(t => t.searchText.length > 0));
});
