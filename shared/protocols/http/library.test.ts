import assert from 'node:assert/strict';
import test from 'node:test';

import {
  libraryFailureSchema,
  libraryOpenFolderRequestSchema,
  libraryRemoveFolderRequestSchema,
  librarySnapshotSchema,
} from './library.ts';

test('library protocol accepts current first-folder fixtures', () => {
  assert.deepEqual(
    librarySnapshotSchema.parse({
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
    librarySnapshotSchema.parse({
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

test('library request rejects unowned and empty paths', () => {
  assert.deepEqual(libraryOpenFolderRequestSchema.parse({ path: '/home/person/Notes' }), {
    path: '/home/person/Notes',
  });
  assert.equal(libraryOpenFolderRequestSchema.safeParse({ path: '' }).success, false);
  assert.equal(
    libraryOpenFolderRequestSchema.safeParse({ create: true, path: '/home/person/Notes' })
      .success,
    false,
  );
  assert.deepEqual(libraryRemoveFolderRequestSchema.parse({ path: '/home/person/Notes' }), {
    path: '/home/person/Notes',
  });
  assert.equal(libraryRemoveFolderRequestSchema.safeParse({ path: '' }).success, false);
  assert.equal(
    libraryRemoveFolderRequestSchema.safeParse({ path: '/home/person/Notes', force: true })
      .success,
    false,
  );
});

test('library failure tolerates additive fields and rejects malformed envelopes', () => {
  assert.deepEqual(
    libraryFailureSchema.parse({
      code: 'WINDOW_CLOSED',
      error: 'window is closed',
      futureDiagnostic: 'ignored',
    }),
    { code: 'WINDOW_CLOSED', error: 'window is closed' },
  );
  assert.equal(libraryFailureSchema.safeParse({ error: '' }).success, false);
});
