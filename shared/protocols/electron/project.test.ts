import assert from 'node:assert/strict';
import test from 'node:test';

import {
  projectFolderDialogRequestSchema,
  projectFolderDialogResponseSchema,
  projectFolderRemovalReadySchema,
  projectFolderRemovalRequestedSchema,
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

test('folder lifecycle preserves whitespace in paths while rejecting blank values', () => {
  const folderPath = '/workspace/notes ';
  assert.equal(projectSetActiveFolderRequestSchema.parse({ folderPath }).folderPath, folderPath);
  assert.deepEqual(projectFolderRemovalReadySchema.parse({ folderPath, requestId: 'r', ready: true }), {
    folderPath, requestId: 'r', ready: true,
  });
  assert.equal(projectFolderDialogRequestSchema.safeParse({ defaultPath: '   ' }).success, false);
});
