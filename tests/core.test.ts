import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { parseAimProject, serializeProject, SQUARE_SOURCE, START, END, exportSource, preserveRegion, safeChild, projectName } from '../src/core/project';
import { interpretVexResult } from '../src/core/hardware';
import { Knowledge } from '../src/knowledge';

test('AIM project roundtrip preserves source, slot and unknown configuration', () => {
  const input = parseAimProject(serializeProject(SQUARE_SOURCE, 3));
  input.aiVisionSettings = { colors: [{ name: 'goal', hue: 20 }], tags: true };
  input.vendorExtra = { keep: true };
  const output = parseAimProject(serializeProject(SQUARE_SOURCE.replace('100', '120'), 4, input));
  assert.equal(output.slot, 3); assert.deepEqual(output.aiVisionSettings, input.aiVisionSettings);
  assert.deepEqual(output.vendorExtra, input.vendorExtra); assert.ok(output.textContent.includes('120'));
  assert.equal(input.slot, 2);
  assert.equal(parseAimProject(serializeProject(SQUARE_SOURCE, 1)).slot, 0);
  assert.equal(parseAimProject(serializeProject(SQUARE_SOURCE, 8)).slot, 7);
});
test('standard VS Code template gets one replaceable configuration region', () => {
  const source = '# Title\r\n\r\nfrom vex import *\r\n\r\n# Robot configuration\r\nrobot = Robot()\r\n\r\nrobot.move_for(200, 0)\r\n';
  const result = exportSource(source);
  assert.equal(result.split(START).length, 2); assert.equal(result.split(END).length, 2);
  assert.ok(result.indexOf('robot.move_for') > result.indexOf(END));
  assert.equal(result.split('Robot()').length, 2); assert.equal(exportSource(result), result);
});
test('official AIM 4.67 regenerated adjacent opening comments can be imported again', () => {
  const data = JSON.parse(serializeProject(SQUARE_SOURCE, 1));
  data.textContent = START + '\n' + START + '\n' + SQUARE_SOURCE;
  const parsed = parseAimProject(JSON.stringify(data));
  assert.equal(parsed.textContent, SQUARE_SOURCE);
  assert.doesNotThrow(() => serializeProject(parsed.textContent, parsed.slot + 1, parsed));
});
test('malformed or nonstandard configurations fail explicitly', () => {
  assert.throws(() => exportSource('print("before config")\nfrom vex import *\nrobot = Robot()\n'));
  assert.throws(() => exportSource(START + '\nrobot = Robot()'));
  assert.throws(() => exportSource(SQUARE_SOURCE + END));
  assert.throws(() => preserveRegion(SQUARE_SOURCE, SQUARE_SOURCE.replace('Robot()', 'Robot("other")')));
  assert.doesNotThrow(() => preserveRegion(SQUARE_SOURCE.replace(/\n/g, '\r\n'), SQUARE_SOURCE));
});
test('reject wrong platform, blocks, archives, oversized source, invalid slots', () => {
  const valid = JSON.parse(serializeProject(SQUARE_SOURCE, 1));
  for (const changes of [{ platform: 'V5' }, { mode: 'Blocks' }, { slot: 8 }, { slot: -1 }, { slot: '1' }, { textContent: 'x'.repeat(120001) }]) assert.throws(() => parseAimProject(JSON.stringify({ ...valid, ...changes })));
  assert.throws(() => parseAimProject('PK\x03\x04archive')); assert.throws(() => serializeProject(SQUARE_SOURCE, 0));
  assert.equal(parseAimProject('\uFEFF' + JSON.stringify(valid)).platform, 'AIM');
});
test('project names and paths reject traversal and reserved Windows names', () => {
  const root = path.resolve('fixture');
  assert.equal(safeChild(root, 'src/main.py'), path.join(root, 'src/main.py'));
  assert.throws(() => safeChild(root, '../outside.py'));
  assert.throws(() => safeChild(root, path.resolve('elsewhere.py')));
  for (const value of ['CON', 'LPT1', '../escape', 'bad/name', '', 'bad.']) assert.throws(() => projectName(value));
  assert.equal(projectName('绿茵 AIM_01'), '绿茵 AIM_01');
});
test('zero status with no device never reports success', () => {
  assert.equal(interpretVexResult({ statusCode: 0, details: 'No device connected' }).state, 'failed');
  assert.equal(interpretVexResult({ statusCode: 0, details: '' }).state, 'unknown');
  assert.equal(interpretVexResult(undefined).state, 'unknown');
  assert.equal(interpretVexResult({ statusCode: -1 }).state, 'failed');
  assert.equal(interpretVexResult({ statusCode: 0, details: 'Download Complete' }).state, 'reported-success');
});
test('knowledge retrieval is bounded and source-backed', async () => {
  const knowledge = new Knowledge(path.resolve('resources/knowledge')); await knowledge.load();
  const context = await knowledge.context('让机器人识别足球并射门，跟队友通信');
  assert.ok(context.ids.includes('vision')); assert.ok(context.ids.includes('kicker'));
  assert.ok(context.ids.length <= 4); assert.ok(context.text.includes('https://api.vex.com/aim/'));
  await assert.rejects(() => knowledge.read('../../secret'));
});
