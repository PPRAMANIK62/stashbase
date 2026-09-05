import { describe, expect, it, vi } from 'vite-plus/test';

import type { DocumentTextSaveResult } from '@/features/documents/domain/document';

import type { DocumentSourceApi } from './ports';
import { createDocumentTabsRuntime } from './tabs-runtime';

function idFactory() {
  let next = 0;
  return () => `tab-${++next}`;
}

function createQueries() {
  return { cancel: vi.fn(async () => undefined), remove: vi.fn(), replaceSource: vi.fn() };
}

function createApi(): DocumentSourceApi {
  return {
    load: vi.fn(),
    overwrite: vi.fn(),
    save: vi.fn(async (_source, input) => ({
      content: input.content,
      format: 'md' as const,
      version: 'saved',
    })),
  };
}

function makeDirty(runtime: ReturnType<typeof createDocumentTabsRuntime>, tabId: string) {
  const document = runtime.getDocument(tabId);
  document?.reconcile({ content: 'before', format: 'md', version: 'v1' });
  document?.change('draft');
  return document;
}

describe('Document tabs runtime', () => {
  it('restores fresh document runtimes and one active source', () => {
    const runtime = createDocumentTabsRuntime({
      api: createApi(),
      createId: idFactory(),
      createQueries,
      folderPath: '/library/notes',
      generation: 3,
      restored: {
        activeTabId: 'tab-plan',
        tabs: [
          {
            id: 'tab-plan',
            source: { folderPath: '/library/notes', path: 'plan.md' },
          },
        ],
      },
    });

    expect(runtime.store.getState().activeTabId).toBe('tab-plan');
    expect(runtime.getDocument('tab-plan')?.scope).toEqual({
      generation: 1,
      id: 'tab-plan',
      source: { folderPath: '/library/notes', path: 'plan.md' },
    });
  });

  it('makes the runtime collection the duplicate-open authority', async () => {
    const createId = vi.fn(idFactory());
    const runtime = createDocumentTabsRuntime({
      api: createApi(),
      createId,
      createQueries,
      folderPath: '/library/notes',
      generation: 1,
    });
    const source = { folderPath: '/library/notes', path: 'plan.md' };

    const first = await runtime.open(source);
    const repeated = await runtime.open({ ...source });

    expect(repeated).toBe(first);
    expect(runtime.store.getState().tabs).toHaveLength(1);
    expect(createId).toHaveBeenCalledOnce();
  });

  it('carries an anchor through the target tab runtime without duplicating its source', async () => {
    const runtime = createDocumentTabsRuntime({
      api: createApi(),
      createId: idFactory(),
      createQueries,
      folderPath: '/library/notes',
      generation: 1,
    });
    const source = { folderPath: '/library/notes', path: 'plan.md' };

    await runtime.open(source, { anchor: 'details' });
    await runtime.open({ ...source }, { anchor: 'summary' });

    expect(runtime.store.getState().tabs).toHaveLength(1);
    expect(runtime.navigation.store.getState().pendingAnchor).toEqual({
      id: 'summary',
      tabId: 'tab-1',
    });
  });

  it('carries a search occurrence through a newly opened document', async () => {
    const runtime = createDocumentTabsRuntime({
      api: createApi(),
      createId: idFactory(),
      createQueries,
      folderPath: '/library/notes',
      generation: 1,
    });
    const controller = {
      close: vi.fn(),
      next: vi.fn(() => ({ current: 2, total: 2 })),
      previous: vi.fn(() => ({ current: 1, total: 2 })),
      setQuery: vi.fn(() => ({ current: 1, total: 2 })),
    };

    await runtime.open(
      { folderPath: '/library/notes', path: 'plan.md' },
      {
        search: {
          caseSensitive: false,
          occurrenceIndex: 1,
          query: 'plan',
          wholeWord: false,
        },
      },
    );
    runtime.navigation.claimFind('tab-1', Symbol('viewer'), controller);

    await vi.waitFor(() => expect(runtime.navigation.store.getState().find.current).toBe(2));
    expect(controller.setQuery).toHaveBeenCalledWith('plan', {
      caseSensitive: false,
      wholeWord: false,
    });
  });

  it('cancels only the closed document and rejects its stale work', async () => {
    const runtime = createDocumentTabsRuntime({
      api: createApi(),
      createId: idFactory(),
      createQueries,
      folderPath: '/library/notes',
      generation: 1,
    });
    const first = await runtime.open({ folderPath: '/library/notes', path: 'one.md' });
    const second = await runtime.open({ folderPath: '/library/notes', path: 'two.md' });
    const capturedScope = first?.scope;
    const completion = vi.fn();

    await runtime.close('tab-1');

    expect(first?.signal.aborted).toBe(true);
    expect(second?.signal.aborted).toBe(false);
    expect(capturedScope && first?.accept(capturedScope, completion)).toBe(false);
    expect(runtime.store.getState().activeTabId).toBe('tab-2');
  });

  it('disposes every child and rejects completions from an older folder scope', async () => {
    const runtime = createDocumentTabsRuntime({
      api: createApi(),
      createId: idFactory(),
      createQueries,
      folderPath: '/library/notes',
      generation: 2,
    });
    const document = await runtime.open({ folderPath: '/library/notes', path: 'one.md' });
    const completion = vi.fn();

    expect(runtime.accept({ folderPath: '/library/notes', generation: 1 }, completion)).toBe(false);
    runtime.dispose();
    runtime.dispose();

    expect(runtime.signal.aborted).toBe(true);
    expect(document?.signal.aborted).toBe(true);
    expect(runtime.store.getState().lifecycle).toBe('disposed');
    expect(runtime.accept(runtime.scope, completion)).toBe(false);
    expect(completion).not.toHaveBeenCalled();
  });

  it('projects only active-folder relative identities for Workspace persistence', async () => {
    const runtime = createDocumentTabsRuntime({
      api: createApi(),
      createId: idFactory(),
      createQueries,
      folderPath: '/library/notes',
      generation: 1,
    });
    await runtime.open({ folderPath: '/library/notes', path: 'inside.md' });
    await runtime.open({ folderPath: '/library/archive', path: 'outside.md' });

    const persisted = runtime.toSession();
    expect(persisted.tabs).toEqual([{ id: 'tab-1', path: 'inside.md' }]);
    expect(persisted.activeTabId).toBeNull();
  });

  it('keeps the current tab mounted when its save barrier fails', async () => {
    const api: DocumentSourceApi = {
      load: vi.fn(),
      overwrite: vi.fn(),
      save: vi.fn(async () => {
        throw new Error('offline');
      }),
    };
    const runtime = createDocumentTabsRuntime({
      api,
      createId: idFactory(),
      createQueries,
      folderPath: '/library/notes',
      generation: 1,
      restored: {
        activeTabId: 'one',
        tabs: [
          { id: 'one', source: { folderPath: '/library/notes', path: 'one.md' } },
          { id: 'two', source: { folderPath: '/library/notes', path: 'two.md' } },
        ],
      },
    });
    makeDirty(runtime, 'one');

    await expect(runtime.activate('two')).resolves.toBe(false);
    await expect(runtime.close('one')).resolves.toBe(false);

    expect(runtime.store.getState().activeTabId).toBe('one');
    expect(runtime.getDocument('one')?.store.getState().editor?.value).toBe('draft');
    expect(runtime.getDocument('one')?.signal.aborted).toBe(false);
  });

  it('waits for the latest live value before closing a dirty tab', async () => {
    const finishSaves: Array<(value: DocumentTextSaveResult) => void> = [];
    const api: DocumentSourceApi = {
      load: vi.fn(),
      overwrite: vi.fn(),
      save: vi.fn(
        () =>
          new Promise<DocumentTextSaveResult>((resolve) => {
            finishSaves.push(resolve);
          }),
      ),
    };
    const runtime = createDocumentTabsRuntime({
      api,
      createId: idFactory(),
      createQueries,
      folderPath: '/library/notes',
      generation: 1,
    });
    const document = await runtime.open({ folderPath: '/library/notes', path: 'one.md' });
    makeDirty(runtime, 'tab-1');

    const closing = runtime.close('tab-1');
    await vi.waitFor(() => expect(api.save).toHaveBeenCalledOnce());
    document?.change('newer draft');
    expect(document?.signal.aborted).toBe(false);

    finishSaves.shift()?.({ content: 'draft', format: 'md', version: 'v2' });
    await vi.waitFor(() => expect(api.save).toHaveBeenCalledTimes(2));
    finishSaves.shift()?.({ content: 'newer draft', format: 'md', version: 'v3' });

    await expect(closing).resolves.toBe(true);
    expect(document?.signal.aborted).toBe(true);
    expect(api.save).toHaveBeenLastCalledWith(
      { folderPath: '/library/notes', path: 'one.md' },
      { baseVersion: 'v2', content: 'newer draft' },
      expect.any(AbortSignal),
    );
  });
});
