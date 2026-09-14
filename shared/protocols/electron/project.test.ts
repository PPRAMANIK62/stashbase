import assert from 'node:assert/strict';
import test from 'node:test';

import {
  projectFolderDialogRequestSchema,
  projectFolderDialogResponseSchema,
  projectFolderRemovalReadySchema,
  projectFolderRemovalRequestedSchema,
  projectInitialFolderResponseSchema,
  projectLifecycleResponseSchema,
  projectPrepareFolderRemovalResponseSchema,
  projectSetActiveFolderRequestSchema,
} from './project.ts';

test('project folder dialog protocol accepts the pinned original request fixture', () => {
  assert.deepEqual(projectFolderDialogRequestSchema.parse({}), {
    allowCreateDirectory: true,
  });
});

test('project folder dialog protocol deliberately tolerates additive response fields', () => {
  assert.deepEqual(
    projectFolderDialogResponseSchema.parse({
      ok: true,
      folderPath: '/workspace/notes',
      futureDiagnostic: 'ignored by this protocol version',
    }),
    { ok: true, folderPath: '/workspace/notes' },
  );
});

test('project folder dialog protocol classifies failures and rejects malformed success data', () => {
  assert.deepEqual(
    projectFolderDialogResponseSchema.parse({
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
    projectFolderDialogResponseSchema.safeParse({ ok: true, folderPath: 42 }).success,
    false,
  );
});

test('project folder dialog request rejects unowned fields and invalid paths', () => {
  assert.equal(
    projectFolderDialogRequestSchema.safeParse({ title: 'Unreviewed dialog title' }).success,
    false,
  );
  assert.equal(projectFolderDialogRequestSchema.safeParse({ defaultPath: '' }).success, false);
});

test('project lifecycle protocol validates folder identity and correlated release responses', () => {
  assert.deepEqual(projectSetActiveFolderRequestSchema.parse({ folderPath: null }), {
    folderPath: null,
  });
  assert.deepEqual(
    projectFolderRemovalRequestedSchema.parse({
      folderPath: '/workspace/notes',
      requestId: 'request-1',
    }),
    { folderPath: '/workspace/notes', requestId: 'request-1' },
  );
  assert.deepEqual(
    projectFolderRemovalReadySchema.parse({
      folderPath: '/workspace/notes',
      ready: false,
      requestId: 'request-1',
    }),
    { folderPath: '/workspace/notes', ready: false, requestId: 'request-1' },
  );
  assert.deepEqual(projectLifecycleResponseSchema.parse({ ok: true }), { ok: true });
  assert.deepEqual(projectPrepareFolderRemovalResponseSchema.parse({ ok: true, ready: true }), {
    ok: true,
    ready: true,
  });
  assert.equal(
    projectFolderRemovalReadySchema.safeParse({
      folderPath: '/workspace/notes',
      ready: true,
      requestId: '',
    }).success,
    false,
  );
});

test('initial folder protocol answers a folder, answers none, and refuses a rewritten answer', () => {
  assert.deepEqual(
    projectInitialFolderResponseSchema.parse({ folderPath: '/workspace/notes', ok: true }),
    { folderPath: '/workspace/notes', ok: true },
  );
  // No folder is the ordinary answer for a window nobody named one for, so it
  // parses as a success rather than arriving as a failure a caller must sort.
  assert.deepEqual(projectInitialFolderResponseSchema.parse({ folderPath: null, ok: true }), {
    folderPath: null,
    ok: true,
  });
  assert.deepEqual(
    projectInitialFolderResponseSchema.parse({
      failure: { kind: 'unauthorized', message: 'This window cannot claim an initial folder.' },
      ok: false,
    }),
    {
      failure: { kind: 'unauthorized', message: 'This window cannot claim an initial folder.' },
      ok: false,
    },
  );
  assert.equal(
    projectInitialFolderResponseSchema.safeParse({ folderPath: 42, ok: true }).success,
    false,
  );
  assert.equal(
    projectInitialFolderResponseSchema.safeParse({ folderPath: '', ok: true }).success,
    false,
  );
  // Strict, unlike the folder dialog: main and the preload ship together, so
  // an unowned field is this build disagreeing with itself.
  assert.equal(
    projectInitialFolderResponseSchema.safeParse({
      folderPath: '/workspace/notes',
      ok: true,
      restored: true,
    }).success,
    false,
  );
});

test('folder lifecycle preserves whitespace in paths while rejecting blank values', () => {
  const folderPath = '/workspace/notes ';
  assert.equal(projectSetActiveFolderRequestSchema.parse({ folderPath }).folderPath, folderPath);
  assert.equal(projectInitialFolderResponseSchema.parse({ ok: true, folderPath }).ok, true);
  assert.deepEqual(projectFolderRemovalReadySchema.parse({ folderPath, requestId: 'r', ready: true }), {
    folderPath, requestId: 'r', ready: true,
  });
  assert.equal(projectFolderDialogRequestSchema.safeParse({ defaultPath: '   ' }).success, false);
});
