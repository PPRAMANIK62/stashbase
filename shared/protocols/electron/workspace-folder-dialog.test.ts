import assert from 'node:assert/strict';
import test from 'node:test';

import {
  workspaceFolderDialogRequestSchema,
  workspaceFolderDialogResponseSchema,
} from './workspace-folder-dialog.ts';

test('workspace folder dialog protocol accepts the pinned original request fixture', () => {
  assert.deepEqual(workspaceFolderDialogRequestSchema.parse({}), {
    allowCreateDirectory: true,
  });
});

test('workspace folder dialog protocol deliberately tolerates additive response fields', () => {
  assert.deepEqual(
    workspaceFolderDialogResponseSchema.parse({
      ok: true,
      folderPath: '/workspace/notes',
      futureDiagnostic: 'ignored by this protocol version',
    }),
    { ok: true, folderPath: '/workspace/notes' },
  );
});

test('workspace folder dialog protocol classifies failures and rejects malformed success data', () => {
  assert.deepEqual(
    workspaceFolderDialogResponseSchema.parse({
      ok: false,
      failure: {
        kind: 'unavailable',
        message: 'The folder picker is unavailable.',
      },
    }),
    {
      ok: false,
      failure: {
        kind: 'unavailable',
        message: 'The folder picker is unavailable.',
      },
    },
  );
  assert.equal(
    workspaceFolderDialogResponseSchema.safeParse({ ok: true, folderPath: 42 }).success,
    false,
  );
});

test('workspace folder dialog request rejects unowned fields and invalid paths', () => {
  assert.equal(
    workspaceFolderDialogRequestSchema.safeParse({ title: 'Unreviewed dialog title' }).success,
    false,
  );
  assert.equal(workspaceFolderDialogRequestSchema.safeParse({ defaultPath: '' }).success, false);
});
