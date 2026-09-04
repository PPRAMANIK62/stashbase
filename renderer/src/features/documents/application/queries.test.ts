import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vite-plus/test';

import {
  createDocumentQueryScope,
  documentQueryKeys,
  documentSourceQuery,
  genericFilePreviewQuery,
} from './queries';

const scope = {
  generation: 3,
  id: 'tab-plan',
  source: { folderPath: '/library/notes', path: 'drafts/plan.md' },
};

describe('document source queries', () => {
  it('keys source bytes by their complete disposable document scope', () => {
    expect(documentQueryKeys.source(scope)).toEqual([
      'documents',
      '/library/notes',
      'drafts/plan.md',
      'tab-plan',
      3,
      'source',
    ]);
  });

  it('loads generic inspection through a separate read-only query', async () => {
    const api = {
      load: vi.fn(async () => ({
        content: 'const answer = 42;',
        kind: 'text' as const,
        name: 'drafts/plan.md',
        size: 18,
      })),
    };
    const controller = new AbortController();
    const query = genericFilePreviewQuery(api, scope);

    await expect(query.queryFn({ signal: controller.signal })).resolves.toMatchObject({
      kind: 'text',
    });
    expect(api.load).toHaveBeenCalledWith(scope.source, controller.signal);
    expect(query.queryKey).toEqual([
      'documents',
      '/library/notes',
      'drafts/plan.md',
      'tab-plan',
      3,
      'generic-preview',
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

  it('cancels and removes every query owned by one document scope', async () => {
    const queryClient = new QueryClient();
    const cancel = vi.spyOn(queryClient, 'cancelQueries');
    const remove = vi.spyOn(queryClient, 'removeQueries');
    const setQueryData = vi.spyOn(queryClient, 'setQueryData');
    const queryScope = createDocumentQueryScope(queryClient, scope);
    const replacement = { content: 'saved', format: 'md' as const, version: 'v2' };

    queryScope.replaceSource(replacement);
    await queryScope.cancel();
    queryScope.remove();

    expect(setQueryData).toHaveBeenCalledWith(documentQueryKeys.source(scope), replacement);
    const scopeKey = documentQueryKeys.scope(scope);
    expect(cancel).toHaveBeenCalledWith({ queryKey: scopeKey });
    expect(remove).toHaveBeenCalledWith({ queryKey: scopeKey });
  });
});
