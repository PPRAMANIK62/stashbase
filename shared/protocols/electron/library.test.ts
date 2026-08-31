import assert from 'node:assert/strict';
import test from 'node:test';

import {
  libraryFolderDialogRequestSchema,
  libraryFolderDialogResponseSchema,
} from './library.ts';

test('library folder dialog protocol accepts the pinned original request fixture', () => {
  assert.deepEqual(libraryFolderDialogRequestSchema.parse({}), {
    allowCreateDirectory: true,
  });
});

test('library folder dialog protocol deliberately tolerates additive response fields', () => {
  assert.deepEqual(
    libraryFolderDialogResponseSchema.parse({
      ok: true,
      folderPath: '/workspace/notes',
      futureDiagnostic: 'ignored by this protocol version',
    }),
    { ok: true, folderPath: '/workspace/notes' },
  );
});

test('library folder dialog protocol classifies failures and rejects malformed success data', () => {
  assert.deepEqual(
    libraryFolderDialogResponseSchema.parse({
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
    libraryFolderDialogResponseSchema.safeParse({ ok: true, folderPath: 42 }).success,
    false,
  );
});

test('library folder dialog request rejects unowned fields and invalid paths', () => {
  assert.equal(
    libraryFolderDialogRequestSchema.safeParse({ title: 'Unreviewed dialog title' }).success,
    false,
  );
  assert.equal(libraryFolderDialogRequestSchema.safeParse({ defaultPath: '' }).success, false);
});
