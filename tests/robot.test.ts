import { test } from 'node:test';
import assert from 'node:assert/strict';
import { robotBatch, robotFields, robotHost, robotTest, robotSummary, testLabel } from '../src/core/robot';

test('robot IP and finite motion bounds reject URLs, injected arguments and unsupported actions', () => {
  assert.equal(robotHost(' 192.168.4.1 '), '192.168.4.1');
  for (const host of ['https://192.168.4.1', '192.168.4.1:80', '--simulate', 'a;exit', '0.0.0.0']) assert.throws(() => robotHost(host));
  assert.equal(testLabel(robotTest({ kind: 'move', amount: 50, speed: 20 })), '直行 50 mm · 20% 速度');
  for (const p of [{ kind: 'move', amount: 201, speed: 20 }, { kind: 'turn', amount: 91, speed: 20 }, { kind: 'move', amount: NaN, speed: 20 }, { kind: 'move', amount: 1, speed: 31 }, { kind: 'kick', amount: 1, speed: 20 }, { kind: 'move', amount: '50', speed: 20 }]) assert.throws(() => robotTest(p));
});
test('batch bounds and field projections reject invalid later steps before execution', () => {
  const step = { kind: 'move', amount: 100, speed: 20 };
  assert.equal(robotBatch({ steps: [step] }).steps[0].direction, 'forward');
  assert.equal(robotFields('all'), 'all');
  assert.deepEqual(robotFields(['headingDeg']), ['headingDeg']);
  for (const fields of [[], ['headingDeg', 'headingDeg'], ['unknown'], 'batteryPercent']) assert.throws(() => robotFields(fields));
  for (const steps of [[], Array(9).fill(step), [...Array(4).fill(step), { ...step, amount: 500 }], [{ ...step, direction: 'left' }], Array(5).fill({ kind: 'turn', amount: 90, speed: 20 })]) assert.throws(() => robotBatch({ steps }));
  assert.throws(() => robotBatch({ steps: [step], headingToleranceDeg: 100 }));
  const square = Array.from({ length: 4 }, () => [step, { kind: 'turn', amount: 90, speed: 20 }]).flat();
  assert.equal(robotBatch({ steps: square }).steps.length, 8);
});
test('robot summaries explicitly preserve simulation provenance and bound model context', () => {
  const data = { mode: 'simulation', capturedAt: 'test', batteryPercent: 80, positionMm: { x: 0, y: 0 }, headingDeg: 0, stopped: true, scope: 'test' } as const;
  assert.match(robotSummary(data), /模拟数据/);
  assert.match(robotSummary(data), /不证明当前学生程序/);
  assert.throws(() => robotSummary({ ...data, scope: 'x'.repeat(8001) }));
});
