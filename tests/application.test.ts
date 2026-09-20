import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { applicationCandidates, launchPlan } from '../src/core/application';

test('export handoff passes a spaced project filename as one argument without a shell', () => {
  const app = path.resolve('VEX Robotics/VEXcode AIM.exe');
  const project = path.resolve('课堂 项目/足球 & square.aimpython');
  const plan = launchPlan(app, project);
  assert.deepEqual(plan.args, [project]); assert.equal(plan.options.shell, false);
  assert.equal(plan.options.env.ELECTRON_RUN_AS_NODE, undefined);
  assert.equal(plan.options.windowsHide, true);
  assert.throws(() => launchPlan(app, 'relative.aimpython'));
  assert.throws(() => launchPlan(app, path.resolve('main.py')));
  assert.throws(() => launchPlan(path.resolve('wrong.exe'), project));
});
test('explicit application path is honored without silently launching another app', () => {
  const explicit = path.resolve('custom/VEXcode AIM.exe');
  assert.deepEqual(applicationCandidates(explicit, {}), [explicit]);
  assert.equal(applicationCandidates('', { ProgramFiles: path.resolve('Program Files') }).length, 1);
});
