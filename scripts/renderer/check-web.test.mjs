// The runner's whole reason to exist is that it does not stop at the first
// failure, and that is exactly what an `&&` chain looks like from the outside
// until something fails. Each case below runs fake gates and asserts the
// runner reached every one of them and said so.
import assert from 'node:assert/strict';
import test from 'node:test';

import { runGates } from './check-web.mjs';

const fakeGates = [
  { name: 'first', command: 'node', args: ['-e', 'process.exit(0)'] },
  { name: 'second', command: 'node', args: ['-e', 'console.error("second broke");process.exit(3)'] },
  { name: 'third', command: 'node', args: ['-e', 'console.error("third broke");process.exit(1)'] },
  { name: 'fourth', command: 'node', args: ['-e', 'process.exit(0)'] },
];

function collect(list) {
  const lines = [];
  const results = runGates(list, { log: (line) => lines.push(line), now: () => 0 });
  return { lines, results, text: lines.join('\n') };
}

test('all gates run after failure, and every failure is reported with its output', () => {
  const { results, lines, text } = collect(fakeGates);
  assert.deepEqual(
    results.map((result) => [result.name, result.passed]),
    [['first', true], ['second', false], ['third', false], ['fourth', true]],
  );
  assert.equal(lines[0], 'running 4 renderer gates: first, second, third, fourth');
  assert.match(text, /2 of 4 renderer gates failed: second, third/);
  assert.match(text, /----- second -----\nsecond broke/);
  assert.match(text, /----- third -----\nthird broke/);
});

test('a clean run says so and reports every gate as passed', () => {
  const { results, text } = collect([fakeGates[0], fakeGates[3]]);
  assert.ok(results.every((result) => result.passed));
  assert.match(text, /All 2 renderer gates passed\./);
});

test('a gate whose command cannot be spawned fails instead of throwing', () => {
  const { results, text } = collect([
    { name: 'missing', command: 'stashbase-no-such-binary', args: [] },
    fakeGates[0],
  ]);
  assert.deepEqual(
    results.map((result) => [result.name, result.passed]),
    [
      ['missing', false],
      ['first', true],
    ],
  );
  assert.match(text, /1 of 2 renderer gates failed: missing/);
});
