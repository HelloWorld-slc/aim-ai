import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changeSummary, detectedProgram } from '../src/core/code-review';
const original = '#region VEXcode Generated Robot Configuration\nfrom vex import *\nrobot = Robot()\n#endregion VEXcode Generated Robot Configuration\n\nSIDE = 100\nrobot.stop_all_movement()\n';
test('full AIM code fences are detected while snippets and competing alternatives are excluded', () => {
  const source = original.replace('SIDE = 100', 'SIDE = 200');
  assert.equal(detectedProgram(`## 代码\n\n\`\`\`python\n${source}\`\`\``, original), source);
  assert.equal(detectedProgram('```python\nrobot.stop_all_movement()\n```', original), undefined);
  assert.equal(detectedProgram(`\`\`\`python\n${source}`, original), undefined);
  assert.equal(detectedProgram(`\`\`\`python\n${source}\`\`\`\n\`\`\`python\n${source}\`\`\``, original), undefined);
  assert.equal(detectedProgram(`\`\`\`python\n${source.replace('robot = Robot()', 'robot = Robot(123)')}\`\`\``, original), undefined);
});
test('change counts compare old and new lines and ignore Windows newline encoding', () => {
  assert.deepEqual(changeSummary('a\nb\nc\n', 'a\nB\nnew\nc\n'), { added: 2, removed: 1 });
  assert.deepEqual(changeSummary('a\r\nb\r\n', 'a\nb\n'), { added: 0, removed: 0 });
});
