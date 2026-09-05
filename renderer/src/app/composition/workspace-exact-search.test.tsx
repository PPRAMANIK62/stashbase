import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { createDocumentTabsRuntime, type DocumentTabsRuntime } from '@/features/documents/public';
import type { ExactSearchApi } from '@/features/retrieval/public';
import { createWorkspaceRuntime, type WorkspaceRuntime } from '@/features/workspace/public';

import { WorkspaceExactSearch } from './workspace-exact-search';

let documents: DocumentTabsRuntime;
let workspace: WorkspaceRuntime;
let getAnimationsDescriptor: PropertyDescriptor | undefined;

beforeEach(() => {
  getAnimationsDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'getAnimations');
  Object.defineProperty(Element.prototype, 'getAnimations', {
    configurable: true,
    value: vi.fn(() => []),
  });
});

afterEach(() => {
  cleanup();
  documents?.dispose();
  workspace?.dispose();
  if (getAnimationsDescriptor) {
    Object.defineProperty(Element.prototype, 'getAnimations', getAnimationsDescriptor);
  } else {
    Reflect.deleteProperty(Element.prototype, 'getAnimations');
  }
});

describe('workspace Exact Search composition', () => {
  it('opens an out-of-folder result under its own read-only source identity', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const api: ExactSearchApi = {
      search: vi.fn(async () => ({
        files: [
          {
            id: '/library/archive\u0000answer.md',
            matches: [
              {
                line: 1,
                ranges: [
                  { end: 6, start: 0 },
                  { end: 17, start: 11 },
                ],
                text: 'answer and answer',
              },
            ],
            source: { folderPath: '/library/archive', path: 'answer.md' },
            totalMatches: 2,
          },
        ],
        totalMatches: 2,
        truncated: false,
      })),
    };
    workspace = createWorkspaceRuntime({
      folder: { name: 'Research', path: '/library/research' },
      generation: 1,
      queries: {
        cancel: () => queryClient.cancelQueries(),
        remove: () => queryClient.removeQueries(),
      },
    });
    documents = createDocumentTabsRuntime({
      api: { load: vi.fn(), overwrite: vi.fn(), save: vi.fn() },
      createId: () => 'search-tab',
      createQueries: () => ({
        cancel: vi.fn(async () => undefined),
        remove: vi.fn(),
        replaceSource: vi.fn(),
      }),
      folderPath: '/library/research',
      generation: 1,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <WorkspaceExactSearch
          active
          activeFolderPath="/library/research"
          api={api}
          documents={documents}
          focusRevision={0}
          scopes={[
            { folderPath: '/library/research', label: 'Research' },
            { folderPath: '/library/archive', label: 'Archive' },
          ]}
          workspace={workspace}
        />
      </QueryClientProvider>,
    );

    await userEvent
      .setup()
      .type(screen.getByRole('combobox', { name: 'Search library' }), 'answer');
    const occurrences = await screen.findAllByRole('option', { name: /answer\.md/u });
    await userEvent.setup().click(occurrences[1]);

    await waitFor(() => {
      const tab = documents.store.getState().tabs[0];
      expect(tab?.source).toEqual({ folderPath: '/library/archive', path: 'answer.md' });
      expect(documents.getDocument(tab?.id ?? '')?.store.getState().access).toBe('read-only');
    });

    const controller = {
      close: vi.fn(),
      next: vi.fn(() => ({ current: 2, total: 2 })),
      previous: vi.fn(() => ({ current: 1, total: 2 })),
      setQuery: vi.fn(() => ({ current: 1, total: 2 })),
    };
    documents.navigation.claimFind('search-tab', Symbol('viewer'), controller);
    await waitFor(() => expect(controller.next).toHaveBeenCalledOnce());
    expect(controller.setQuery).toHaveBeenCalledWith('answer', {
      caseSensitive: false,
      wholeWord: false,
    });
  });
});
