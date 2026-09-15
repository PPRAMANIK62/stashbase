import { afterEach, expect, it, vi } from 'vite-plus/test';

import {
  documentQueryScope,
  documentTabsRuntimeOptions,
  sourceApi,
  textSource,
} from '@/test/fakes/documents';

import { createDocumentRuntime } from './document-runtime';
import { DocumentSaveError } from './ports';
import { createDocumentTabsRuntime, type DocumentTabsRuntime } from './tabs-runtime';

const disposers: Array<() => void> = [];
afterEach(() => {
  disposers.splice(0).forEach((dispose) => dispose());
  vi.useRealTimers();
});

it('autosaves a hidden document while navigation remains available after a save failure', async () => {
  vi.useFakeTimers();
  const api = sourceApi({ save: vi.fn().mockRejectedValue(new Error('offline')) });
  const runtime = createDocumentTabsRuntime(documentTabsRuntimeOptions({ api }));
  disposers.push(() => runtime.dispose());
  const document = await runtime.open({ folderPath: '/project/notes', path: 'a.txt' });
  if (!document) throw new Error('Document did not open.');
  document.reconcile(textSource({ format: 'txt' }));
  document.change('local draft');
  await runtime.open({ folderPath: '/project/notes', path: 'b.txt' });
  await vi.advanceTimersByTimeAsync(600);
  expect(api.save).toHaveBeenCalledOnce();
  expect(document.store.getState().editor?.save.kind).toBe('failed');
  expect(runtime.activeSource()?.path).toBe('b.txt');
  expect(await runtime.close(document.scope.id)).toBe(false);
  expect(document.store.getState().editor?.value).toBe('local draft');
});

it('compares again if the reviewed disk version changes before Keep my version', async () => {
  const api = sourceApi({
    save: vi.fn().mockRejectedValue(new DocumentSaveError('conflict', 'changed')),
    load: vi
      .fn()
      .mockResolvedValueOnce(textSource({ content: 'disk two', version: 'v2' }))
      .mockResolvedValueOnce(textSource({ content: 'disk three', version: 'v3' })),
  });
  const document = createDocumentRuntime({
    activeFolderPath: '/project/notes',
    source: { folderPath: '/project/notes', path: 'a.md' },
    generation: 1,
    id: 'a',
    queries: documentQueryScope(),
  });
  disposers.push(() => document.dispose());
  document.reconcile(textSource({ content: 'initial', version: 'v1' }));
  document.change('local draft');
  expect(await document.save(api)).toBe(false);
  expect(await document.resolveConflict(api, 'overwrite')).toBe(false);
  expect(api.save).toHaveBeenLastCalledWith(
    document.scope.source,
    { baseVersion: 'v2', content: 'local draft' },
    expect.any(AbortSignal),
  );
  expect(document.store.getState().editor?.save).toMatchObject({
    kind: 'conflict',
    conflict: { diskContent: 'disk three', editorContent: 'local draft', diskVersion: 'v3' },
  });
});

it('retains an uncertain rename, blocks edits at the old path, and rebinds after confirmation', async () => {
  const runtime: DocumentTabsRuntime = createDocumentTabsRuntime(documentTabsRuntimeOptions());
  disposers.push(() => runtime.dispose());
  const document = await runtime.open({ folderPath: '/project/notes', path: 'a.md' });
  if (!document) throw new Error('Document did not open.');
  document.reconcile(textSource({ content: 'saved' }));
  expect(await runtime.mutate('a.md', async () => undefined)).toBe(false);
  document.change('would target an unknown path');
  expect(document.store.getState().editor?.value).toBe('saved');
  expect(await runtime.close(document.scope.id)).toBe(false);
  expect(await runtime.mutate('a.md', async () => 'renamed.md')).toBe(true);
  document.change('new edit');
  expect(document.store.getState().editor?.value).toBe('new edit');
  expect(runtime.getDocument(document.scope.id)).toBe(document);
  expect(document.scope.source.path).toBe('renamed.md');
});
