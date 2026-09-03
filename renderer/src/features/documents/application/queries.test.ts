import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vite-plus/test';

import { createDocumentQueryScope, documentQueryKeys, documentSourceQuery } from './queries';

const scope = {
  generation: 3,
  id: 'tab-plan',
  source: { folderPath: '/library/notes', path: 'drafts/plan.md' },
};

describe('document source queries', () => {
  it('keys source bytes by their complete disposable document scope', () => {
    expect(documentQueryKeys.source(scope)).toEqual([
      'documents',
      'source',
      '/library/notes',
      'drafts/plan.md',
      'tab-plan',
      3,
    ]);
  });

  it('loads through the source port with query cancellation', async () => {
    const api = {
      load: vi.fn(async () => ({ content: '# Plan', format: 'md' as const, version: 'v1' })),
      overwrite: vi.fn(),
      save: vi.fn(),
    };
    const controller = new AbortController();
    const query = documentSourceQuery(api, scope);

    await expect(query.queryFn({ signal: controller.signal })).resolves.toEqual({
      content: '# Plan',
      format: 'md',
      version: 'v1',
    });
    expect(api.load).toHaveBeenCalledWith(scope.source, controller.signal);
    expect(query.retry).toBe(false);
  });

  it('cancels and removes only one document query', async () => {
    const queryClient = new QueryClient();
    const cancel = vi.spyOn(queryClient, 'cancelQueries');
    const remove = vi.spyOn(queryClient, 'removeQueries');
    const setQueryData = vi.spyOn(queryClient, 'setQueryData');
    const queryScope = createDocumentQueryScope(queryClient, scope);
    const replacement = { content: 'saved', format: 'md' as const, version: 'v2' };

    queryScope.replaceSource(replacement);
    await queryScope.cancel();
    queryScope.remove();

    const queryKey = documentQueryKeys.source(scope);
    expect(setQueryData).toHaveBeenCalledWith(queryKey, replacement);
    expect(cancel).toHaveBeenCalledWith({ queryKey });
    expect(remove).toHaveBeenCalledWith({ queryKey });
  });
});
