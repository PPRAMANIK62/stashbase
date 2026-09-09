import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vite-plus/test';

import {
  createDocumentQueryScope,
  documentQueryKeys,
  documentSourceQuery,
  docxPreviewQuery,
  genericFilePreviewQuery,
  refreshDocumentSources,
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

  it('keys DOCX conversion by the source version inside its document scope', async () => {
    const resource = {
      fallbackUrl: 'http://127.0.0.1/asset-derived/report.docx?v=v2',
      kind: 'docx' as const,
      url: 'http://127.0.0.1/asset/report.docx?v=v2',
      version: 'v2',
    };
    const api = { load: vi.fn(async () => ({ html: '<p>Report</p>' })) };
    const controller = new AbortController();
    const query = docxPreviewQuery(api, scope, resource);

    await expect(query.queryFn({ signal: controller.signal })).resolves.toEqual({
      html: '<p>Report</p>',
    });
    expect(api.load).toHaveBeenCalledWith(resource, controller.signal);
    expect(query.queryKey).toEqual([
      'documents',
      '/library/notes',
      'drafts/plan.md',
      'tab-plan',
      3,
      'docx-preview',
      'v2',
    ]);
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

  it('refetches only the open documents behind externally written sources', () => {
    const queryClient = new QueryClient();
    const other = { ...scope, id: 'tab-other', source: { ...scope.source, path: 'other.md' } };
    queryClient.setQueryData(documentQueryKeys.source(scope), { content: 'a', version: 'v1' });
    queryClient.setQueryData(documentQueryKeys.source(other), { content: 'b', version: 'v1' });
    queryClient.setQueryData(['workspace', 'folder', '/library/notes', 'files'], { files: [] });

    refreshDocumentSources(queryClient, [
      { folderPath: '/library/notes', path: 'drafts/plan.md' },
      { folderPath: '/library/elsewhere', path: 'other.md' },
    ]);

    expect(queryClient.getQueryState(documentQueryKeys.source(scope))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(documentQueryKeys.source(other))?.isInvalidated).toBe(false);
    expect(
      queryClient.getQueryState(['workspace', 'folder', '/library/notes', 'files'])?.isInvalidated,
    ).toBe(false);
  });
});
