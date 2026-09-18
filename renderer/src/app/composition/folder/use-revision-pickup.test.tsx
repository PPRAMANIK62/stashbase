import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import type { DocumentRevisionProposal, DocumentTabsRuntime } from '@/features/documents/public';
import { createDocumentTabsRuntime } from '@/features/documents/public';
import { createWorkspaceRuntime } from '@/features/workspace/test-support';
import {
  documentTabsRuntimeOptions,
  revisionsApi,
  sourceApi,
  textSource,
} from '@/test/fakes/documents';

import { useRevisionPickup } from './use-revision-pickup';

const folderPath = '/project/notes';
const BASE = '# Plan\n';
const BASE_VERSION = 'sha256:v1';
const currentSource = sourceApi({
  load: vi.fn(async () => textSource({ content: BASE, version: BASE_VERSION })),
});

const open: Array<{ dispose(): void }> = [];

afterEach(() => {
  for (const runtime of open.splice(0)) runtime.dispose();
});

function proposal(overrides: Partial<DocumentRevisionProposal> = {}): DocumentRevisionProposal {
  return {
    id: 'proposal-1',
    baseVersion: BASE_VERSION,
    content: '# Revised plan\n',
    createdAt: 0,
    origin: { kind: 'agent' },
    source: { folderPath, path: 'plan.md' },
    ...overrides,
  };
}

function createWorkspace() {
  const workspace = createWorkspaceRuntime({
    folder: { name: 'Notes', path: folderPath },
    generation: 1,
    queries: { cancel: vi.fn(async () => undefined), remove: vi.fn() },
  });
  open.push(workspace);
  return workspace;
}

/** Stands in for the React tree, which is what loads a tab's text in the
 *  running window. Without it every opened tab stays editor-less. */
function loadEveryTab(documents: DocumentTabsRuntime) {
  const load = () => {
    for (const tab of documents.store.getState().tabs) {
      documents
        .getDocument(tab.id)
        ?.reconcile(textSource({ content: BASE, version: BASE_VERSION }));
    }
  };
  open.push({ dispose: documents.subscribe(load) });
  load();
}

function createDocuments() {
  const documents = createDocumentTabsRuntime(
    documentTabsRuntimeOptions({ api: sourceApi(), folderPath }),
  );
  open.push(documents);
  loadEveryTab(documents);
  return documents;
}

function mountPickup(proposals: readonly DocumentRevisionProposal[], unresolved: string[] = []) {
  const documents = createDocuments();
  const workspace = createWorkspace();
  const pending = [...proposals];
  const unnamed = [...unresolved];
  const api = revisionsApi({
    drain: vi.fn(async () => ({ proposals: pending.splice(0), unresolved: unnamed.splice(0) })),
  });
  const view = renderHook(() =>
    useRevisionPickup({ api, documents, sourceApi: currentSource, workspace }),
  );
  return { ...view, documents, workspace };
}

function reviewOn(documents: DocumentTabsRuntime, path: string) {
  const tab = documents.store.getState().tabs.find((entry) => entry.source.path === path);
  return tab ? (documents.getDocument(tab.id)?.store.getState().revision ?? null) : null;
}

describe('picking up parked revisions', () => {
  it('opens the document as a kept tab and starts its review', async () => {
    const { documents, result } = mountPickup([proposal()]);

    await waitFor(() => expect(reviewOn(documents, 'plan.md')?.kind).toBe('starting'));
    expect(result.current.failures).toEqual([]);
    expect(documents.store.getState().tabs.map((tab) => tab.preview)).toEqual([false]);
  });

  it('turns two proposals for one document into one review and one said refusal', async () => {
    const { documents, result } = mountPickup([proposal(), proposal()]);

    await waitFor(() => expect(result.current.failures).toHaveLength(1));
    expect(result.current.failures[0]).toContain('plan.md');
    expect(result.current.failures[0]).toContain('while its first review was still open');
    expect(reviewOn(documents, 'plan.md')?.kind).toBe('starting');
    expect(documents.store.getState().tabs).toHaveLength(1);
  });

  it('says so when a proposal names a document this window does not hold', async () => {
    const { result } = mountPickup([
      proposal({ source: { folderPath: '/project/other', path: 'strategy.md' } }),
    ]);

    await waitFor(() => expect(result.current.failures).toHaveLength(1));
    expect(result.current.failures[0]).toContain('strategy.md');
    expect(result.current.failures[0]).toContain('not in the folder this window has open');
  });

  it('says so when the drain handed over a path it could not resolve', async () => {
    // The host deleted it on the way out, so a proposal with no source here
    // still has to reach the reader by name.
    const { result } = mountPickup([], ['roadmap.md']);

    await waitFor(() => expect(result.current.failures).toHaveLength(1));
    expect(result.current.failures[0]).toContain('roadmap.md');
    expect(result.current.failures[0]).toContain('not in the folder this window has open');
  });

  it('drops one sentence when the reader dismisses it', async () => {
    const { result } = mountPickup([proposal(), proposal()]);

    await waitFor(() => expect(result.current.failures).toHaveLength(1));
    const [message] = result.current.failures;
    if (message) result.current.dismiss(message);

    await waitFor(() => expect(result.current.failures).toEqual([]));
  });

  it('forgets what it could not show once the window moves to another folder', async () => {
    const first = createDocuments();
    const workspace = createWorkspace();
    const api = revisionsApi({
      drain: vi.fn(async (folder: string) => ({
        proposals:
          folder === folderPath
            ? [proposal({ source: { folderPath: '/project/other', path: 'strategy.md' } })]
            : [],
        unresolved: [],
      })),
    });
    const { rerender, result } = renderHook(
      ({ documents }: { documents: DocumentTabsRuntime }) =>
        useRevisionPickup({ api, documents, sourceApi: currentSource, workspace }),
      { initialProps: { documents: first } },
    );
    await waitFor(() => expect(result.current.failures).toHaveLength(1));

    const second = createDocumentTabsRuntime(
      documentTabsRuntimeOptions({ api: sourceApi(), folderPath: '/project/archive' }),
    );
    open.push(second);
    rerender({ documents: second });

    await waitFor(() => expect(result.current.failures).toEqual([]));
  });

  it('never drains while there is nowhere to put the result', () => {
    const api = revisionsApi();
    renderHook(() =>
      useRevisionPickup({ api, documents: null, sourceApi: currentSource, workspace: null }),
    );
    expect(api.drain).not.toHaveBeenCalled();
  });
});
