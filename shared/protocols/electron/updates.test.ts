import assert from 'node:assert/strict';
import test from 'node:test';

import {
  UPDATE_PHASES,
  updatesResultSchema,
  updatesSetAutoCheckRequestSchema,
  updatesSetSimulationRequestSchema,
  updatesSnapshotSchema,
} from './updates.ts';

const state = { autoCheckEnabled: true, currentVersion: '2.0.0' };

test('every phase main can reach is a phase a window can be told', () => {
  for (const phase of UPDATE_PHASES) {
    const carriesVersion =
      phase === 'available' || phase === 'downloading' || phase === 'ready' || phase === 'installing';
    const parsed = updatesSnapshotSchema.safeParse({
      ...state,
      ...(carriesVersion ? { availableVersion: '2.0.1' } : {}),
      phase,
    });
    assert.equal(parsed.success, true, `${phase} must parse`);
  }
});

test('a phase without an update carries no version, and one with an update requires it', () => {
  assert.equal(
    updatesSnapshotSchema.safeParse({ ...state, availableVersion: '2.0.1', phase: 'idle' }).success,
    false,
    'idle cannot carry a version',
  );
  assert.equal(
    updatesSnapshotSchema.safeParse({ ...state, phase: 'available' }).success,
    false,
    'available without a version is not a description of anything',
  );
  assert.equal(
    updatesSnapshotSchema.safeParse({ ...state, availableVersion: '  ', phase: 'ready' }).success,
    false,
  );
});

test('a percentage exists only while bytes are moving', () => {
  assert.equal(
    updatesSnapshotSchema.safeParse({
      ...state,
      availableVersion: '2.0.1',
      percent: 42,
      phase: 'downloading',
    }).success,
    true,
  );
  assert.equal(
    updatesSnapshotSchema.safeParse({ ...state, availableVersion: '2.0.1', phase: 'downloading' })
      .success,
    true,
    'progress main could not read is a download with no percentage',
  );
  assert.equal(
    updatesSnapshotSchema.safeParse({
      ...state,
      availableVersion: '2.0.1',
      percent: 100,
      phase: 'ready',
    }).success,
    false,
    'ready is not a percentage',
  );
  assert.equal(
    updatesSnapshotSchema.safeParse({
      ...state,
      availableVersion: '2.0.1',
      percent: 140,
      phase: 'downloading',
    }).success,
    false,
  );
});

test("the installer's own sentence never reaches a window", () => {
  assert.equal(
    updatesSnapshotSchema.safeParse({
      ...state,
      message: 'ENOENT: latest-mac.yml',
      phase: 'error',
    }).success,
    false,
  );
});

test('a result is either the snapshot main stands behind or the refusal', () => {
  assert.equal(
    updatesResultSchema.safeParse({ ok: true, snapshot: { ...state, phase: 'current' } }).success,
    true,
  );
  assert.equal(
    updatesResultSchema.safeParse({ failure: { kind: 'unauthorized' }, ok: false }).success,
    true,
  );
  assert.equal(updatesResultSchema.safeParse({ ok: true }).success, false);
  assert.equal(
    updatesResultSchema.safeParse({ failure: { kind: 'nope' }, ok: false }).success,
    false,
  );
  assert.equal(
    updatesResultSchema.safeParse({
      failure: { kind: 'failed', message: 'boom' },
      ok: false,
    }).success,
    false,
  );
});

test('requests are exactly what they claim', () => {
  assert.equal(updatesSetAutoCheckRequestSchema.safeParse({ enabled: false }).success, true);
  assert.equal(updatesSetAutoCheckRequestSchema.safeParse({ enabled: 'yes' }).success, false);
  assert.equal(updatesSetSimulationRequestSchema.safeParse({ value: 'ready' }).success, true);
  assert.equal(updatesSetSimulationRequestSchema.safeParse({ value: 'install' }).success, false);
});
