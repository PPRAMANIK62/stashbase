import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { createDocumentTabsRuntime } from '@/features/documents/application/tabs-runtime';
import { documentTabsRuntimeOptions, sourceApi, textSource } from '@/test/fakes/documents';

import { useOpenRevisions } from './use-open-revisions';

const folderPath = '/project/notes';
const review = {
  baseVersion: 'sha256:v1',
  id: 'review-1',
  origin: { kind: 'agent' as const },
  proposal: '# Revised plan\n',
};

const runtimes: Array<{ dispose(): void }> = [];

afterEach(() => {
  for (const runtime of runtimes.splice(0)) runtime.dispose();
});

async function openDocument(path: string) {
  const documents = createDocumentTabsRuntime(
    documentTabsRuntimeOptions({ api: sourceApi(), folderPath }),
  );
  runtimes.push(documents);
  const document = await documents.open({ folderPath, path });
  if (!document) throw new Error('Expected the document to open.');
  document.reconcile(textSource({ content: '# Plan\n', version: 'sha256:v1' }));
  return { document, documents };
}

describe('the reviews open across a folder', () => {
  it('reports nothing while no document holds one', async () => {
    const { documents } = await openDocument('plan.md');
    const { result } = renderHook(() => useOpenRevisions(documents));

    expect([...result.current.keys()]).toEqual([]);
    expect([...renderHook(() => useOpenRevisions(null)).result.current.keys()]).toEqual([]);
  });

  it('reports the count the editor published, keyed by the document path', async () => {
    const { document, documents } = await openDocument('plan.md');
    const { result } = renderHook(() => useOpenRevisions(documents));

    act(() => {
      document.startRevision(review, '# Plan\n');
      document.publishRevisionCount('review-1', 3);
    });

    expect(result.current.get('plan.md')?.pending).toBe(3);
    expect(result.current.get('plan.md')?.id).toBe('review-1');

    const first = result.current;
    act(() => document.publishRevisionCount('review-1', 3));
    // An unrelated store write must not hand a reader a new map to re-render on.
    expect(result.current).toBe(first);

    act(() => document.publishRevisionCount('review-1', 1));
    expect(result.current.get('plan.md')?.pending).toBe(1);

    act(() => document.clearRevision());
    expect(result.current.get('plan.md')).toBeUndefined();
  });

  it('drives the controls the surface holding the review registered', async () => {
    const { document, documents } = await openDocument('plan.md');
    const acceptAll = vi.fn();
    const rejectAll = vi.fn();
    document.bindRevisionControls({ acceptAll, rejectAll });
    const { result } = renderHook(() => useOpenRevisions(documents));

    act(() => {
      document.startRevision(review, '# Plan\n');
      document.publishRevisionCount('review-1', 2);
    });
    result.current.get('plan.md')?.acceptAll();
    result.current.get('plan.md')?.rejectAll();

    expect(acceptAll).toHaveBeenCalledTimes(1);
    expect(rejectAll).toHaveBeenCalledTimes(1);
  });
});
