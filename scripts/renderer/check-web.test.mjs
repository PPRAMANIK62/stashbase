// The runner's whole reason to exist is that it does not stop at the first
// failure, and that is exactly what an `&&` chain looks like from the outside
// until something fails. Each case below runs fake gates and asserts the
// runner reached every one of them and said so.
import assert from 'node:assert/strict';
import test from 'node:test';

import { gates, runGates } from './check-web.mjs';

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

test('every gate runs even after an earlier one fails', () => {
  const { results } = collect(fakeGates);
  assert.deepEqual(
    results.map((result) => [result.name, result.passed]),
    [
      ['first', true],
      ['second', false],
      ['third', false],
      ['fourth', true],
    ],
  );
});

test('the run opens by naming every gate it is about to run', () => {
  const { lines } = collect(fakeGates);
  assert.equal(lines[0], 'running 4 renderer gates: first, second, third, fourth');
});

test('each gate gets one status line and every failure is named in the summary', () => {
  const { lines, text } = collect(fakeGates);
  assert.equal(lines[1], 'pass  first (0s)');
  assert.equal(lines[2], 'FAIL  second (0s)');
  assert.equal(lines[3], 'FAIL  third (0s)');
  assert.equal(lines[4], 'pass  fourth (0s)');
  assert.match(text, /2 of 4 renderer gates failed: second, third/);
});

test('the output of every failing gate is replayed, not just the first', () => {
  const { text } = collect(fakeGates);
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

test('the shipped gate list covers every renderer quality command in review order', () => {
  assert.deepEqual(
    gates.map((gate) => gate.name),
    [
      'architecture',
      'size',
      'conventions',
      'unused',
      'duplication',
      'format',
      'lint',
      'coverage',
      'typecheck',
      'build',
      'storybook',
    ],
  );
  for (const gate of gates) {
    assert.equal(gate.command, 'pnpm', `${gate.name} must run through the package scripts`);
    assert.equal(gate.args.length, 1, `${gate.name} names exactly one script`);
  }
});
