import assert from 'node:assert/strict';
import test from 'node:test';

import {
  projectFailureSchema,
  projectOpenFolderRequestSchema,
  projectRemoveFolderRequestSchema,
  projectRegistrySnapshotSchema,
} from './project.ts';

test('project protocol accepts current first-folder fixtures', () => {
  assert.deepEqual(
    projectRegistrySnapshotSchema.parse({
      current: null,
      homeDir: '/home/person/StashBase',
      recent: [],
    }),
    {
      current: null,
      homeDir: '/home/person/StashBase',
      recent: [],
    },
  );

  assert.deepEqual(
    projectRegistrySnapshotSchema.parse({
      current: { name: 'Notes', path: '/home/person/Notes' },
      futureField: true,
      homeDir: '/home/person/StashBase',
      recent: [
        {
          favorite: true,
          futureField: true,
          openedAt: '2026-08-31T12:00:00.000Z',
          path: '/home/person/Notes',
        },
      ],
    }),
    {
      current: { name: 'Notes', path: '/home/person/Notes' },
      homeDir: '/home/person/StashBase',
      recent: [
        {
          favorite: true,
          openedAt: '2026-08-31T12:00:00.000Z',
          path: '/home/person/Notes',
        },
      ],
    },
  );
});

test('project request rejects unowned and empty paths', () => {
  assert.deepEqual(projectOpenFolderRequestSchema.parse({ path: '/home/person/Notes' }), {
    path: '/home/person/Notes',
  });
  assert.equal(projectOpenFolderRequestSchema.safeParse({ path: '' }).success, false);
  assert.equal(
    projectOpenFolderRequestSchema.safeParse({ create: true, path: '/home/person/Notes' })
      .success,
    false,
  );
  assert.deepEqual(projectRemoveFolderRequestSchema.parse({ path: '/home/person/Notes' }), {
    path: '/home/person/Notes',
  });
  assert.equal(projectRemoveFolderRequestSchema.safeParse({ path: '' }).success, false);
  assert.equal(
    projectRemoveFolderRequestSchema.safeParse({ path: '/home/person/Notes', force: true })
      .success,
    false,
  );
});

test('project failure tolerates additive fields and rejects malformed envelopes', () => {
  assert.deepEqual(
    projectFailureSchema.parse({
      code: 'WINDOW_CLOSED',
      error: 'window is closed',
      futureDiagnostic: 'ignored',
    }),
    { code: 'WINDOW_CLOSED', error: 'window is closed' },
  );
  assert.equal(projectFailureSchema.safeParse({ error: '' }).success, false);
});

test('project transport retains exact path spelling for open, remove, and snapshots', () => {
  const path = '/workspace/notes ';
  assert.deepEqual(projectOpenFolderRequestSchema.parse({ path }), { path });
  assert.deepEqual(projectRemoveFolderRequestSchema.parse({ path }), { path });
  const snapshot = { current: { path, name: 'notes ' }, homeDir: '/home/user ', recent: [] };
  assert.deepEqual(projectRegistrySnapshotSchema.parse(snapshot), snapshot);
  assert.equal(projectOpenFolderRequestSchema.safeParse({ path: '  ' }).success, false);
});
