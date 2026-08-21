import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pythonCandidates, resolvePython } from '../scripts/run-python.mjs';

test('portable Python candidates cover Windows and POSIX launchers in native order', () => {
  assert.deepEqual(pythonCandidates('win32'), [
    { command: 'python', prefix: [] },
    { command: 'py', prefix: ['-3'] },
    { command: 'python3', prefix: [] },
  ]);
  assert.deepEqual(pythonCandidates('linux'), [
    { command: 'python3', prefix: [] },
    { command: 'python', prefix: [] },
    { command: 'py', prefix: ['-3'] },
  ]);
});

test('portable Python resolution skips unavailable launchers', () => {
  const calls = [];
  const selected = resolvePython({
    platform: 'win32',
    spawn(command, args) {
      calls.push([command, args]);
      return { status: command === 'py' ? 0 : 1 };
    },
  });
  assert.deepEqual(selected, { command: 'py', prefix: ['-3'] });
  assert.deepEqual(calls, [
    ['python', ['--version']],
    ['py', ['-3', '--version']],
  ]);
});

test('npm Python commands use the portable launcher', async () => {
  const packageData = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  for (const name of ['validate', 'test:e2e', 'package:release', 'capture:screenshots', 'validate:version', 'test:closeout']) {
    assert.match(packageData.scripts[name], /^node scripts\/run-python\.mjs /, `${name} bypasses the portable launcher`);
  }
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
  assert.doesNotMatch(readme, /^python3 -m /m);
  assert.match(readme, /node scripts\/run-python\.mjs -m pip install/);
});
