import { describe, expect, it } from 'vite-plus/test';

import { changedSource, fileBasename, fileChangesForTool, settledFileChanges } from './file-change';

describe('Agent file changes', () => {
  it('reads Claude edits and writes as fragments and whole files', () => {
    expect(
      fileChangesForTool('Edit', {
        file_path: '/library/Research/notes.md',
        new_string: 'b',
        old_string: 'a',
      }),
    ).toEqual([
      {
        action: 'edited',
        path: '/library/Research/notes.md',
        text: { after: 'b', before: 'a', extent: 'fragment' },
      },
    ]);
    expect(
      fileChangesForTool('MultiEdit', {
        edits: [
          { new_string: '2', old_string: '1' },
          { new_string: '4', old_string: '3' },
        ],
        file_path: 'notes.md',
      }),
    ).toHaveLength(2);
    expect(fileChangesForTool('Write', { content: '# New', file_path: 'new.md' })).toEqual([
      { action: 'wrote', path: 'new.md', text: { after: '# New', before: '', extent: 'file' } },
    ]);
    expect(
      fileChangesForTool('NotebookEdit', { new_source: 'x', notebook_path: 'a.ipynb' }),
    ).toEqual([{ action: 'edited', path: 'a.ipynb' }]);
  });

  it('unwraps MCP mutation arguments and ignores reads', () => {
    expect(
      fileChangesForTool('mcp__stashbase__edit_file', {
        arguments: { new_text: 'after', old_text: 'before', path: '/library/Research/notes.md' },
      }),
    ).toEqual([
      {
        action: 'edited',
        path: '/library/Research/notes.md',
        text: { after: 'after', before: 'before', extent: 'fragment' },
      },
    ]);
    expect(
      fileChangesForTool('stashbase_write_file', { arguments: { content: 'hi', path: 'a.md' } }),
    ).toMatchObject([{ action: 'wrote', path: 'a.md' }]);
    expect(fileChangesForTool('stashbase_delete_file', { path: 'a.md' })).toEqual([
      { action: 'deleted', path: 'a.md' },
    ]);
    expect(fileChangesForTool('stashbase_read_file', { path: 'a.md' })).toEqual([]);
    expect(fileChangesForTool('Bash', { command: 'rm a.md' })).toEqual([]);
  });

  it('keeps server diffs whole with their counts and reads Codex patches', () => {
    expect(
      fileChangesForTool('FileDiff', {
        additions: 1,
        after: 'one\ntwo\n',
        before: 'one\n',
        deletions: 0,
        path: 'notes.md',
      }),
    ).toEqual([
      {
        action: 'changed',
        counts: { additions: 1, deletions: 0 },
        path: 'notes.md',
        text: { after: 'one\ntwo\n', before: 'one\n', extent: 'file' },
      },
    ]);
    expect(
      fileChangesForTool('FileDiff', { after: 'x', before: '', path: 'new.md' }),
    ).toMatchObject([{ action: 'created' }]);
    expect(
      fileChangesForTool('File change', {
        changes: [
          { diff: '@@ -1 +1 @@\n-a\n+b\n', kind: { type: 'update' }, path: 'notes.md' },
          { kind: 'add', path: 'new.md' },
          { path: '' },
          'junk',
        ],
      }),
    ).toEqual([
      { action: 'edited', patch: '@@ -1 +1 @@\n-a\n+b\n', path: 'notes.md' },
      { action: 'created', path: 'new.md' },
    ]);
  });

  it('lists only settled changes, once per path with the latest action', () => {
    const changes = settledFileChanges([
      { input: { content: 'a', file_path: 'a.md' }, name: 'Write', status: 'done' },
      {
        input: { file_path: 'a.md', new_string: 'b', old_string: 'a' },
        name: 'Edit',
        status: 'done',
      },
      { input: { content: 'x', file_path: 'denied.md' }, name: 'Write', status: 'denied' },
      { input: { content: 'x', file_path: 'running.md' }, name: 'Write', status: 'running' },
      { input: { command: 'ls' }, name: 'Bash', status: 'done' },
    ]);
    expect(changes).toMatchObject([{ action: 'edited', path: 'a.md' }]);
  });

  it('resolves changed paths to sources only inside the scoped folder', () => {
    const scope = { kind: 'folder' as const, path: '/library/Research' };
    expect(changedSource(scope, '/library/Research/notes/a.md')).toEqual({
      folderPath: '/library/Research',
      path: 'notes/a.md',
    });
    expect(changedSource(scope, 'notes/a.md')).toEqual({
      folderPath: '/library/Research',
      path: 'notes/a.md',
    });
    expect(changedSource(scope, './a.md')).toEqual({
      folderPath: '/library/Research',
      path: 'a.md',
    });
    expect(changedSource(scope, '/library/Other/a.md')).toBeNull();
    expect(changedSource(scope, '/library/Research')).toBeNull();
    expect(changedSource(scope, '../a.md')).toBeNull();
    expect(changedSource(scope, 'C:/Users/a.md')).toBeNull();
    expect(
      changedSource(
        { kind: 'folder', path: 'C:\\Library\\Research' },
        'C:\\Library\\Research\\a.md',
      ),
    ).toEqual({
      folderPath: 'C:\\Library\\Research',
      path: 'a.md',
    });
    expect(changedSource({ kind: 'library' }, 'a.md')).toBeNull();
  });

  it('names a file by its last segment on either separator', () => {
    expect(fileBasename('/library/Research/notes/a.md')).toBe('a.md');
    expect(fileBasename('C:\\Library\\a.md')).toBe('a.md');
    expect(fileBasename('a.md')).toBe('a.md');
  });
});
