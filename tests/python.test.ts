import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { SQUARE_SOURCE } from '../src/core/project';

function check(source: string) {
  const executable = process.platform === 'win32' ? 'py' : 'python3';
  const result = spawnSync(executable, [...(process.platform === 'win32' ? ['-3'] : []), path.resolve('resources/check_python.py')], { input: JSON.stringify({ source }), encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, result.stderr); return JSON.parse(result.stdout).issues as any[];
}
test('square and existing classroom source parse without execution', () => {
  assert.deepEqual(check(SQUARE_SOURCE), []);
  const existing = path.resolve('../AIM_Square/src/main.py');
  if (fs.existsSync(existing)) assert.deepEqual(check(fs.readFileSync(existing, 'utf8')), []);
  const trap = 'raise RuntimeError("must never run")\n'; assert.deepEqual(check(trap), []);
});
test('syntax errors include line locations', () => {
  const issues = check('for x in range(4)\n    pass\n');
  assert.equal(issues[0].severity, 'error'); assert.equal(issues[0].line, 1);
});
test('platform imports and busy loops are warnings', () => {
  const issues = check('import requests\nbrain = Brain()\nwhile True:\n    pass\n');
  assert.equal(issues.length, 3); assert.ok(issues.every(i => i.severity === 'warning'));
});
