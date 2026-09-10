import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BUG_REPORT_CAPABILITY,
  BUG_REPORT_OPEN_CHANNEL,
  bugReportOpenResponseSchema,
} from './bug-report.ts';

test('the open capability keeps the legacy channel name and a closed response set', () => {
  assert.equal(BUG_REPORT_OPEN_CHANNEL, 'bug-report:open');
  assert.equal(BUG_REPORT_CAPABILITY, 'bug-report.open');
  assert.equal(bugReportOpenResponseSchema.safeParse({ ok: true }).success, true);
  assert.equal(
    bugReportOpenResponseSchema.safeParse({
      failure: { kind: 'unauthorized', message: 'This window cannot report a bug.' },
      ok: false,
    }).success,
    true,
  );
  assert.equal(bugReportOpenResponseSchema.safeParse({ ok: true, draftId: 'x' }).success, false);
});
