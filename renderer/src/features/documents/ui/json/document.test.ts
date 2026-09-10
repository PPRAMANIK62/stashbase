import { describe, expect, it } from 'vite-plus/test';

import type { JsonDocumentSession } from '@/features/documents/domain/document';

import { createJsonTreeFindController } from './document';

describe('JSON tree Find controller', () => {
  it('reveals matching paths and drops matches removed by a source edit', () => {
    let source = '{"users":[{"name":"Ada"},{"name":"Grace"}],"count":2}';
    let session: JsonDocumentSession = {
      expandedPaths: ['$'],
      search: '',
      searchOptions: { caseSensitive: false, wholeWord: false },
      selectedPath: '$',
      viewMode: 'tree',
    };
    const controller = createJsonTreeFindController(
      () => source,
      () => session,
      (patch) => {
        session = { ...session, ...patch };
      },
    );

    expect(controller.setQuery('grace', { caseSensitive: false, wholeWord: true })).toEqual({
      current: 1,
      total: 1,
    });
    expect(session.selectedPath).toBe('$.users[1].name');
    expect(session.expandedPaths).toContain('$.users[1]');
    expect(session.searchOptions).toEqual({ caseSensitive: false, wholeWord: true });

    source = '{"users":[{"name":"Ada"}],"count":2}';
    expect(controller.next()).toEqual({ current: 0, total: 0 });
    controller.close();
    expect(session.search).toBe('');
  });
});
