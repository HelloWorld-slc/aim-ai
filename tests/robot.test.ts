import { test } from 'node:test';
import assert from 'node:assert/strict';
import { robotHost, robotTest, robotSummary, testLabel } from '../src/core/robot';

test('robot IP and finite motion bounds reject URLs, injected arguments and unsupported actions', () => {
  assert.equal(robotHost(' 192.168.4.1 '), '192.168.4.1');
  for (const host of ['https://192.168.4.1', '192.168.4.1:80', '--simulate', 'a;exit', '0.0.0.0']) assert.throws(() => robotHost(host));
  assert.equal(testLabel(robotTest({ kind: 'move', amount: 50, speed: 20 })), '直行 50 mm · 20% 速度');
  for (const p of [{ kind: 'move', amount: 201, speed: 20 }, { kind: 'turn', amount: 91, speed: 20 }, { kind: 'move', amount: NaN, speed: 20 }, { kind: 'move', amount: 1, speed: 31 }, { kind: 'kick', amount: 1, speed: 20 }, { kind: 'move', amount: '50', speed: 20 }]) assert.throws(() => robotTest(p));
});
test('robot summaries explicitly preserve simulation provenance and bound model context', () => {
  const data = { mode: 'simulation', capturedAt: 'test', batteryPercent: 80, positionMm: { x: 0, y: 0 }, headingDeg: 0, stopped: true, scope: 'test' } as const;
  assert.match(robotSummary(data), /模拟数据/);
  assert.match(robotSummary(data), /不证明当前学生程序/);
  assert.throws(() => robotSummary({ ...data, scope: 'x'.repeat(8001) }));
});
