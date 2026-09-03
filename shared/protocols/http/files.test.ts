import assert from 'node:assert/strict';
import test from 'node:test';

import {
  documentTextSaveFailureSchema,
  documentTextOverwriteRequestSchema,
  documentTextSaveRequestSchema,
  documentTextSaveResponseSchema,
  documentTextSourceFailureSchema,
  documentTextSourceRequestSchema,
  documentTextSourceResponseSchema,
  workspaceFilesSchema,
} from './files.ts';

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

test('document text source contracts retain content, format, and source version', () => {
  assert.deepEqual(
    documentTextSourceRequestSchema.parse({
      folderPath: '/library/notes',
      path: 'drafts/plan.markdown',
    }),
    { folderPath: '/library/notes', path: 'drafts/plan.markdown' },
  );
  assert.deepEqual(
    documentTextSourceResponseSchema.parse({
      content: '# Plan\n',
      format: 'md',
      name: 'drafts/plan.markdown',
      version: 'sha256:abc',
    }),
    {
      content: '# Plan\n',
      format: 'md',
      name: 'drafts/plan.markdown',
      version: 'sha256:abc',
    },
  );
});

test('document text source contracts distinguish unsupported encoding from transport failure', () => {
  const unsupported = documentTextSourceResponseSchema.parse({
    content: '',
    error: {
      code: 'UNSUPPORTED_ENCODING',
      message: 'legacy.txt is not valid UTF-8',
    },
    format: 'txt',
    name: 'legacy.txt',
    version: 'sha256:def',
  });
  assert.equal('error' in unsupported && unsupported.error.code, 'UNSUPPORTED_ENCODING');
  assert.deepEqual(
    documentTextSourceFailureSchema.parse({ code: 'NO_FOLDER', error: 'no folder open' }),
    { code: 'NO_FOLDER', error: 'no folder open' },
  );
  assert.equal(
    documentTextSourceResponseSchema.safeParse({
      content: 'missing version',
      format: 'txt',
      name: 'notes.txt',
    }).success,
    false,
  );
});

test('document text save contracts require identity, expected version, and authoritative result', () => {
  assert.deepEqual(
    documentTextSaveRequestSchema.parse({
      baseVersion: 'sha256:before',
      content: '# Changed\n',
      folderPath: '/library/notes',
      path: 'drafts/plan.md',
    }),
    {
      baseVersion: 'sha256:before',
      content: '# Changed\n',
      folderPath: '/library/notes',
      path: 'drafts/plan.md',
    },
  );
  assert.deepEqual(
    documentTextSaveResponseSchema.parse({
      content: '# Changed\r\n',
      format: 'md',
      name: 'drafts/plan.md',
      version: 'sha256:after',
    }),
    {
      content: '# Changed\r\n',
      format: 'md',
      name: 'drafts/plan.md',
      version: 'sha256:after',
    },
  );
  assert.deepEqual(
    documentTextSaveResponseSchema.parse({
      content: '{"changed":true}\r\n',
      format: 'json',
      name: 'drafts/data.json',
      version: 'sha256:json-after',
    }),
    {
      content: '{"changed":true}\r\n',
      format: 'json',
      name: 'drafts/data.json',
      version: 'sha256:json-after',
    },
  );
  assert.deepEqual(
    documentTextSaveFailureSchema.parse({
      code: 'FILE_CHANGED',
      currentVersion: 'sha256:external',
      error: 'file changed on disk',
    }),
    {
      code: 'FILE_CHANGED',
      currentVersion: 'sha256:external',
      error: 'file changed on disk',
    },
  );
  assert.equal(
    documentTextSaveRequestSchema.safeParse({
      content: '# Missing version',
      folderPath: '/library/notes',
      path: 'plan.md',
    }).success,
    false,
  );
});

test('document text overwrite requires an explicit conflict decision', () => {
  assert.deepEqual(
    documentTextOverwriteRequestSchema.parse({
      content: '# Editor draft\n',
      folderPath: '/library/notes',
      overwrite: true,
      path: 'drafts/plan.md',
    }),
    {
      content: '# Editor draft\n',
      folderPath: '/library/notes',
      overwrite: true,
      path: 'drafts/plan.md',
    },
  );
  assert.equal(
    documentTextOverwriteRequestSchema.safeParse({
      content: '# Editor draft\n',
      folderPath: '/library/notes',
      path: 'drafts/plan.md',
    }).success,
    false,
  );
});
