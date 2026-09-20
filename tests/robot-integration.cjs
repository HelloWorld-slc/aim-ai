// Real MCP stdio / Python adapter, explicitly simulated hardware. No model API.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
require('tsx/cjs');
const { RobotClient } = require('../src/core/robot.ts');

(async () => {
  const root = path.resolve(__dirname, '..');
  const python = process.env.AIM_AI_ROBOT_PYTHON || path.join(root, '.robot-runtime', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
  const client = new RobotClient();
  const passed = [];
  try {
    const initial = await client.connect(python, path.join(root, 'robot/server.py'), '', true);
    assert.equal(initial.mode, 'simulation'); assert.equal(initial.batteryPercent, 80); passed.push('real stdio handshake and explicit simulation');
    const list = await client.client.listTools();
    assert.deepEqual(list.tools.map(t => t.name).sort(), ['robot_connect', 'robot_disconnect', 'robot_snapshot', 'robot_stop', 'robot_test']); passed.push('only five gateway tools; no shell, files, continuous movement or raw upstream tools');
    const denied = await client.client.callTool({ name: 'robot_test', arguments: { kind: 'move', amount: 50, speed: 20, approval: 'wrong' } });
    assert.equal(denied.isError, true); assert.equal((await client.snapshot()).positionMm.y, 0); passed.push('missing user token never moves hardware');
    assert.throws(() => client.test({ kind: 'move', amount: 1000, speed: 20 })); passed.push('host rejects out-of-bounds motion');
    const bad = await client.client.callTool({ name: 'robot_test', arguments: { kind: 'turn', amount: 1000, speed: 20, approval: client.token } });
    assert.equal(bad.isError, true); passed.push('backend independently rejects invalid motion and reports MCP error');
    const report = await client.test({ kind: 'move', amount: 50, speed: 20 });
    assert.equal(report.measured.positionDeltaMm, 50); assert.equal(report.mode, 'simulation'); passed.push('bounded movement reuses upstream functions and reports measurements');
    const turn = await client.test({ kind: 'turn', amount: 45, speed: 20 });
    assert.equal(turn.measured.headingChangeDeg, 45); passed.push('bounded turn summary');
    const vision = await client.snapshot(true);
    assert.deepEqual(Object.keys(vision.vision), ['SPORTS_BALL', 'BLUE_BARREL', 'ORANGE_BARREL']); passed.push('bounded vision data without images');
    const stopped = await client.stop(); assert.equal(stopped.confirmed, false); passed.push('stop response does not claim physical confirmation');
    const cancelled = client.test({ kind: 'move', amount: 50, speed: 20 });
    await new Promise(r => setTimeout(r, 70)); await client.stop(); await assert.rejects(cancelled); passed.push('stop cancels in-progress test and reports failure');
    await assert.rejects(client.test({ kind: 'move', amount: 50, speed: 20 })); passed.push('interrupted session cannot silently resume motion');
    await client.close(); assert.equal(client.active, false);
    await client.connect(python, path.join(root, 'robot/server.py'), '', true);
    assert.equal((await client.snapshot()).positionMm.y, 0); passed.push('new session clears old movement state');
    await client.close(); await assert.rejects(client.snapshot()); passed.push('closed sessions reject reads');
    await fs.mkdir(path.join(root, 'test-results'), { recursive: true });
    await fs.writeFile(path.join(root, 'test-results/robot-integration.json'), JSON.stringify({ passed, hardwareTested: false, remoteModelTested: false }, null, 2));
    console.log(`${passed.length} robot MCP integration checks passed; hardware and paid APIs not used.`);
  } finally { await client.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
