import { describe, expect, it } from 'vite-plus/test';

import { buildConflictMarkerDraft, computeConflictDiff } from './conflict-diff';

describe('document conflict diff', () => {
  it('keeps shared context and aligns the changed middle', () => {
    expect(
      computeConflictDiff('shared\neditor one\neditor two\ntail', 'shared\ndisk one\ntail'),
    ).toEqual([
      {
        diskLineNumber: 1,
        diskText: 'shared',
        editorLineNumber: 1,
        editorText: 'shared',
        type: 'equal',
      },
      {
        diskLineNumber: 2,
        diskText: 'disk one',
        editorLineNumber: 2,
        editorText: 'editor one',
        type: 'modify',
      },
      {
        diskLineNumber: undefined,
        diskText: undefined,
        editorLineNumber: 3,
        editorText: 'editor two',
        type: 'delete',
      },
      {
        diskLineNumber: 3,
        diskText: 'tail',
        editorLineNumber: 4,
        editorText: 'tail',
        type: 'equal',
      },
    ]);
  });

  it('preserves both changed blocks inside a merge draft', () => {
    expect(buildConflictMarkerDraft('shared\neditor\ntail', 'shared\ndisk\ntail')).toBe(
      [
        'shared',
        '<<<<<<< Editor Version',
        'editor',
        '=======',
        'disk',
        '>>>>>>> Disk Version',
        'tail',
      ].join('\n'),
    );
  });

  it('stays linear-sized for large documents', () => {
    const editor = Array.from({ length: 10_000 }, (_, index) => `editor ${index}`).join('\n');
    const disk = Array.from({ length: 10_000 }, (_, index) => `disk ${index}`).join('\n');
    expect(computeConflictDiff(editor, disk)).toHaveLength(10_000);
  });
});
