import assert from 'node:assert/strict';
import test from 'node:test';

import {
  libraryFolderDialogRequestSchema,
  libraryFolderDialogResponseSchema,
  libraryFolderRemovalReadySchema,
  libraryFolderRemovalRequestedSchema,
  libraryInitialFolderResponseSchema,
  libraryLifecycleResponseSchema,
  libraryPrepareFolderRemovalResponseSchema,
  librarySetActiveFolderRequestSchema,
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

test('library lifecycle protocol validates folder identity and correlated release responses', () => {
  assert.deepEqual(librarySetActiveFolderRequestSchema.parse({ folderPath: null }), {
    folderPath: null,
  });
  assert.deepEqual(
    libraryFolderRemovalRequestedSchema.parse({
      folderPath: '/workspace/notes',
      requestId: 'request-1',
    }),
    { folderPath: '/workspace/notes', requestId: 'request-1' },
  );
  assert.deepEqual(
    libraryFolderRemovalReadySchema.parse({
      folderPath: '/workspace/notes',
      ready: false,
      requestId: 'request-1',
    }),
    { folderPath: '/workspace/notes', ready: false, requestId: 'request-1' },
  );
  assert.deepEqual(libraryLifecycleResponseSchema.parse({ ok: true }), { ok: true });
  assert.deepEqual(libraryPrepareFolderRemovalResponseSchema.parse({ ok: true, ready: true }), {
    ok: true,
    ready: true,
  });
  assert.equal(
    libraryFolderRemovalReadySchema.safeParse({
      folderPath: '/workspace/notes',
      ready: true,
      requestId: '',
    }).success,
    false,
  );
});

test('initial folder protocol answers a folder, answers none, and refuses a rewritten answer', () => {
  assert.deepEqual(
    libraryInitialFolderResponseSchema.parse({ folderPath: '/workspace/notes', ok: true }),
    { folderPath: '/workspace/notes', ok: true },
  );
  // No folder is the ordinary answer for a window nobody named one for, so it
  // parses as a success rather than arriving as a failure a caller must sort.
  assert.deepEqual(libraryInitialFolderResponseSchema.parse({ folderPath: null, ok: true }), {
    folderPath: null,
    ok: true,
  });
  assert.deepEqual(
    libraryInitialFolderResponseSchema.parse({
      failure: { kind: 'unauthorized', message: 'This window cannot claim an initial folder.' },
      ok: false,
    }),
    {
      failure: { kind: 'unauthorized', message: 'This window cannot claim an initial folder.' },
      ok: false,
    },
  );
  assert.equal(
    libraryInitialFolderResponseSchema.safeParse({ folderPath: 42, ok: true }).success,
    false,
  );
  assert.equal(
    libraryInitialFolderResponseSchema.safeParse({ folderPath: '', ok: true }).success,
    false,
  );
  // Strict, unlike the folder dialog: main and the preload ship together, so
  // an unowned field is this build disagreeing with itself.
  assert.equal(
    libraryInitialFolderResponseSchema.safeParse({
      folderPath: '/workspace/notes',
      ok: true,
      restored: true,
    }).success,
    false,
  );
});
