import assert from 'node:assert/strict';
import test from 'node:test';

import { workspaceFilesSchema } from './files.ts';

test('workspace listing accepts visible and restricted filesystem entries', () => {
  const listing = workspaceFilesSchema.parse({
    folder: 'Research',
    files: [
      {
        name: 'notes/plan.md',
        format: 'md',
        heading: 'Plan',
        snippet: 'First step',
        size: 42,
        imported_at: '2026-09-01T00:00:00.000Z',
      },
      {
        name: 'socket',
        format: 'generic',
        heading: '',
        snippet: '',
        size: 0,
        imported_at: '',
        entryKind: 'special',
        availability: 'unreadable',
      },
    ],
    folders: [{ path: 'notes' }, { path: 'node_modules', kind: 'excluded' }],
  });

  assert.equal(listing.files[1]?.entryKind, 'special');
  assert.equal(listing.folders[1]?.kind, 'excluded');
});

test('workspace listing rejects unknown formats and unowned fields', () => {
  assert.equal(
    workspaceFilesSchema.safeParse({
      folder: 'Research',
      files: [
        {
          name: 'plan.md',
          format: 'markdown',
          heading: '',
          snippet: '',
          size: 1,
          imported_at: '',
        },
      ],
      folders: [],
    }).success,
    false,
  );
  assert.equal(
    workspaceFilesSchema.safeParse({ folder: 'Research', files: [], folders: [], secret: true })
      .success,
    false,
  );
});
