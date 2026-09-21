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
  assert.equal(knowledge.topics.length, 44);
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
  assert.equal(catalog.length, 44);
  assert.equal(catalog.find(t => t.id === 'timer')?.parent, 'logic');
  assert.ok(catalog.find(t => t.id === 'screen')?.searchText.includes('draw_rectangle'));
  assert.ok(catalog.find(t => t.id === 'threads')?.searchText.includes('线程'));
  assert.ok(catalog.every(t => t.searchText.length > 0));
  const guide = await knowledge.read('robot-debug');
  for (const field of ['run_robot_batch', 'fields', 'batteryPercent', 'positionMm', 'headingDeg', 'stopped', 'vision', 'withinTolerance', 'net.displacementMm']) assert.ok(guide.includes(field));
  assert.ok((await knowledge.context('MCP自主调试 返回参数')).ids.includes('robot-debug'));
});

test('vision course topics are readable, linked and retrievable by real recognition questions', async () => {
  const knowledge = await library();
  const topics = knowledge.topics.filter(t => t.id === 'vision-guide' || t.parent === 'vision-guide');
  assert.equal(topics.length, 12);
  const manifest = JSON.parse(await fs.readFile(path.join(root, 'vision-sources.json'), 'utf8'));
  for (const topic of topics) {
    const body = await knowledge.read(topic.id);
    assert.ok(body.includes(topic.source!), topic.id);
    assert.ok(body.length < MAX_CONTEXT_CHARS / 2, `${topic.id}: usable in bounded context`);
    assert.ok(manifest.sources.some((s: { url: string; topicIds: string[] }) => s.url === topic.source && s.topicIds.includes(topic.id)), topic.id);
    for (const link of body.matchAll(/\]\(([a-z-]+\.md)\)/g)) await fs.access(path.join(root, link[1]));
  }
  for (const [query, expected] of [
    ['图像识别课程有哪些资料', 'vision-guide'], ['怎么看摄像头画面和仪表板', 'vision-observe'],
    ['多个球时怎么选择目标，空元组怎么处理', 'vision-data'], ['视野多宽，像素能当距离吗', 'vision-geometry'],
    ['光照和地面反光会影响识别吗', 'vision-environment'], ['识别不到球或认错，目标丢失怎么办', 'vision-errors'],
    ['AprilTag编号和球门标记导航', 'vision-apriltags'], ['颜色识别如何设置色相饱和度', 'vision-colors'],
    ['找球后怎么对准球再瞄准球门', 'vision-football'], ['按识别结果条件判断，避免重复踢球', 'vision-decisions'],
    ['新物体训练集和模型权重', 'vision-training'], ['识别测试准确率和任务卡', 'vision-tests']
  ]) {
    const context = await knowledge.context(query);
    assert.ok(context.ids.includes(expected), `${query}: ${context.ids.join(', ')}`);
    assert.ok(context.ids.length <= 4);
    assert.ok(context.text.length <= MAX_CONTEXT_CHARS);
  }
});
