import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AGENT_TURN_FAILED_MESSAGE,
  recordFailureBeforeContinuing,
  TurnErrorTracker,
} from '@/features/agent-panel/components/turnFailure.ts';

test('a bare failed terminal event adds one generic explanation', () => {
  const tracker = new TurnErrorTracker();
  tracker.start();

  assert.deepEqual(tracker.finish(true), {
    duplicate: false,
    failureMessage: AGENT_TURN_FAILED_MESSAGE,
  });
  assert.deepEqual(tracker.finish(true), {
    duplicate: true,
    failureMessage: null,
  });
});

test('a specific runtime error suppresses the generic fallback', () => {
  const tracker = new TurnErrorTracker();
  tracker.start();
  tracker.explain();

  assert.deepEqual(tracker.finish(true), {
    duplicate: false,
    failureMessage: null,
  });
});

test('successful and cancelled turns do not add an error, and the next turn resets the guard', () => {
  const tracker = new TurnErrorTracker();
  tracker.start();
  tracker.explain();
  assert.equal(tracker.finish(false).failureMessage, null);

  tracker.start();
  assert.equal(tracker.finish(true).failureMessage, AGENT_TURN_FAILED_MESSAGE);
});

test('the failure is recorded before the next queued prompt continues', () => {
  const tracker = new TurnErrorTracker();
  tracker.start();
  const events: string[] = [];

  recordFailureBeforeContinuing(
    tracker.finish(true),
    (message) => events.push(`error:${message}`),
    () => events.push('next queued prompt'),
  );
  recordFailureBeforeContinuing(
    tracker.finish(true),
    (message) => events.push(`error:${message}`),
    () => events.push('unexpected duplicate continuation'),
  );

  assert.deepEqual(events, [
    `error:${AGENT_TURN_FAILED_MESSAGE}`,
    'next queued prompt',
  ]);
});
