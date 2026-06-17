import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-conversion-status-home-'));
process.env.HOME = home;
process.env.STASHBASE_LOCAL_DATA_ROOT = path.join(home, 'app-data');

test('in-flight conversion checks match exact files and folder prefixes', async () => {
  const {
    clearRecord,
    hasInFlightUnder,
    isInFlight,
    markInFlight,
  } = await import('./conversion-status.ts');

  markInFlight('Space/calls/recording.md');
  markInFlight('Space/paper.pdf');
  try {
    assert.equal(isInFlight('Space/calls/recording.md'), true);
    assert.equal(isInFlight('Space/calls'), false);
    assert.equal(hasInFlightUnder('Space/calls'), true);
    assert.equal(hasInFlightUnder('Space/calls/'), true);
    assert.equal(hasInFlightUnder('Space/call'), false);
    assert.equal(hasInFlightUnder('Other/calls'), false);
    assert.equal(hasInFlightUnder('Space/paper.pdf'), true);
  } finally {
    clearRecord('Space/calls/recording.md');
    clearRecord('Space/paper.pdf');
  }
});

test('clearRecordsUnder removes in-flight and failed descendants only', async () => {
  const {
    clearRecord,
    clearRecordsUnder,
    hasInFlightUnder,
    isInFlight,
    listFailed,
    markFailed,
    markInFlight,
  } = await import('./conversion-status.ts');

  markInFlight('Space/docs/running.pdf');
  markFailed('Space/docs/failed.pdf', 'extract failed');
  markFailed('Space/docs-other/keep.pdf', 'keep');
  try {
    clearRecordsUnder('Space/docs/');

    assert.equal(isInFlight('Space/docs/running.pdf'), false);
    assert.equal(hasInFlightUnder('Space/docs'), false);
    assert.equal(listFailed().some((row) => row.path === 'Space/docs/failed.pdf'), false);
    assert.equal(listFailed().some((row) => row.path === 'Space/docs-other/keep.pdf'), true);
  } finally {
    clearRecord('Space/docs/running.pdf');
    clearRecord('Space/docs/failed.pdf');
    clearRecord('Space/docs-other/keep.pdf');
  }
});
