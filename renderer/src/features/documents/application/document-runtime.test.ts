import { describe, expect, it, vi } from 'vite-plus/test';

import { documentQueryScope, textSource } from '@/test/fakes/documents';

import { createDocumentRuntime, DOCUMENT_RESTORE_WAIT_MS } from './document-runtime';

function createRuntime(access: 'editable' | 'read-only' = 'editable') {
  return createDocumentRuntime({
    activeFolderPath: access === 'editable' ? '/library/notes' : '/library/other',
    generation: 1,
    id: 'tab-1',
    queries: documentQueryScope(),
    source: { folderPath: '/library/notes', path: 'plan.md' },
  });
}

describe('document runtime draft restore', () => {
  it('loads the draft as unsaved text over the loaded source', async () => {
    const runtime = createRuntime();
    runtime.reconcile(textSource({ content: 'disk', version: 'v2' }));

    await expect(runtime.restoreDraft({ content: 'draft', expectedVersion: 'v1' })).resolves.toBe(
      'restored',
    );
    expect(runtime.store.getState().editor).toMatchObject({
      baseline: 'disk',
      restores: 1,
      save: { kind: 'dirty' },
      value: 'draft',
      version: 'v1',
    });
  });

  it('waits for the source to land before restoring', async () => {
    const runtime = createRuntime();
    const outcome = runtime.restoreDraft({ content: 'draft', expectedVersion: 'v1' });
    expect(runtime.store.getState().editor).toBeNull();

    runtime.reconcile(textSource({ content: 'disk', version: 'v1' }));
    await expect(outcome).resolves.toBe('restored');
    expect(runtime.store.getState().editor?.value).toBe('draft');
  });

  it('reports a draft that matches the disk as unchanged', async () => {
    const runtime = createRuntime();
    runtime.reconcile(textSource({ content: 'same', version: 'v1' }));
    await expect(runtime.restoreDraft({ content: 'same', expectedVersion: 'v0' })).resolves.toBe(
      'unchanged',
    );
    expect(runtime.store.getState().editor?.save.kind).toBe('clean');
  });

  it('refuses when the document is read-only, disposed, or never loads', async () => {
    vi.useFakeTimers();
    try {
      const readOnly = createRuntime('read-only');
      readOnly.reconcile(textSource({ content: 'disk' }));
      const pendingReadOnly = readOnly.restoreDraft({ content: 'draft', expectedVersion: 'v1' });
      await vi.advanceTimersByTimeAsync(DOCUMENT_RESTORE_WAIT_MS);
      await expect(pendingReadOnly).resolves.toBe('refused');

      const disposed = createRuntime();
      const pendingDisposed = disposed.restoreDraft({ content: 'draft', expectedVersion: 'v1' });
      disposed.dispose();
      await expect(pendingDisposed).resolves.toBe('refused');

      const stuck = createRuntime();
      const pendingStuck = stuck.restoreDraft({ content: 'draft', expectedVersion: 'v1' });
      await vi.advanceTimersByTimeAsync(DOCUMENT_RESTORE_WAIT_MS);
      await expect(pendingStuck).resolves.toBe('refused');
    } finally {
      vi.useRealTimers();
    }
  });
});
