import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import type {
  DocumentSourceApi,
  DocumentWindowLifecycle,
} from '@/features/documents/application/ports';
import { createDocumentTabsRuntime } from '@/features/documents/application/tabs-runtime';

import { useDocumentSaveBarrier } from './use-document-save-barrier';

afterEach(cleanup);

describe('document native save barrier', () => {
  it('answers from the live runtime and retains a failed draft', async () => {
    const handlers: Array<() => boolean | Promise<boolean>> = [];
    const lifecycle: DocumentWindowLifecycle = {
      onPrepareContextRelease: vi.fn((handler) => {
        handlers.push(handler);
        return () => {
          handlers.splice(handlers.indexOf(handler), 1);
        };
      }),
    };
    const api: DocumentSourceApi = {
      load: vi.fn(),
      save: vi.fn(async () => {
        throw new Error('offline');
      }),
    };
    const runtime = createDocumentTabsRuntime({
      api,
      createId: vi.fn(),
      createQueries: () => ({
        cancel: vi.fn(async () => undefined),
        remove: vi.fn(),
        replaceSource: vi.fn(),
      }),
      folderPath: '/library/notes',
      generation: 1,
      restored: {
        activeTabId: 'plan',
        tabs: [{ id: 'plan', source: { folderPath: '/library/notes', path: 'plan.md' } }],
      },
    });
    const document = runtime.getDocument('plan');
    document?.reconcile({ content: 'before', format: 'md', version: 'v1' });
    document?.change('draft');

    const hook = renderHook(({ current }) => useDocumentSaveBarrier(current, lifecycle), {
      initialProps: { current: runtime as typeof runtime | null },
    });

    let ready = true;
    await act(async () => {
      ready = (await handlers[0]?.()) ?? true;
    });

    expect(ready).toBe(false);
    expect(document?.store.getState().editor?.value).toBe('draft');
    expect(document?.signal.aborted).toBe(false);

    hook.rerender({ current: null });
    expect(await handlers[0]?.()).toBe(true);
  });
});
