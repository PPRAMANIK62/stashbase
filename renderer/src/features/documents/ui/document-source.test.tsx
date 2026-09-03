import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  DocumentSaveError,
  DocumentSourceError,
  type DocumentSourceApi,
} from '@/features/documents/application/ports';
import { createDocumentQueryScope } from '@/features/documents/application/queries';
import { createDocumentTabsRuntime } from '@/features/documents/application/tabs-runtime';

import { DocumentWorkspace } from './document-workspace';

const runtimes: ReturnType<typeof createDocumentTabsRuntime>[] = [];
let getAnimationsDescriptor: PropertyDescriptor | undefined;

beforeEach(() => {
  getAnimationsDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'getAnimations');
  Object.defineProperty(Element.prototype, 'getAnimations', {
    configurable: true,
    value: vi.fn(() => []),
  });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  for (const runtime of runtimes.splice(0)) runtime.dispose();
  if (getAnimationsDescriptor) {
    Object.defineProperty(Element.prototype, 'getAnimations', getAnimationsDescriptor);
  } else {
    Reflect.deleteProperty(Element.prototype, 'getAnimations');
  }
  getAnimationsDescriptor = undefined;
});

function renderSource(
  api: DocumentSourceApi,
  source = { folderPath: '/library/notes', path: 'plan.md' },
  options: {
    onNavigate?: Parameters<typeof DocumentWorkspace>[0]['onNavigate'];
    onOpenExternal?: Parameters<typeof DocumentWorkspace>[0]['onOpenExternal'];
  } = {},
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const runtime = createDocumentTabsRuntime({
    api,
    createId: () => 'tab-1',
    createQueries: (scope) => createDocumentQueryScope(queryClient, scope),
    folderPath: '/library/notes',
    generation: 1,
    restored: {
      activeTabId: 'tab-1',
      tabs: [{ id: 'tab-1', source }],
    },
  });
  runtimes.push(runtime);
  render(
    <QueryClientProvider client={queryClient}>
      <DocumentWorkspace api={api} runtime={runtime} {...options} />
    </QueryClientProvider>,
  );
  return { queryClient, runtime };
}

describe('document text source', () => {
  it('loads versioned Markdown into the Milkdown document surface', async () => {
    const api = {
      load: vi.fn(async () => ({
        content: '# Plan\n\n- Keep the source',
        format: 'md' as const,
        version: 'sha256:abc',
      })),
      overwrite: vi.fn(),
      save: vi.fn(),
    };
    const { runtime } = renderSource(api);

    expect(screen.getByRole('status').textContent).toContain('Loading plan.md');
    const source = await screen.findByRole(
      'document',
      { name: 'plan.md Markdown content' },
      { timeout: 5_000 },
    );

    expect(await screen.findByRole('heading', { name: 'Plan' }, { timeout: 5_000 })).not.toBeNull();
    expect(source.querySelector('[contenteditable="true"]')).not.toBeNull();
    expect(screen.queryByLabelText('plan.md source')).toBeNull();
    expect(api.load).toHaveBeenCalledWith(
      { folderPath: '/library/notes', path: 'plan.md' },
      expect.any(AbortSignal),
    );
    await waitFor(() =>
      expect(runtime.navigation.store.getState().outline.headings).toEqual([
        expect.objectContaining({ id: 'plan', level: 1, text: 'Plan' }),
      ]),
    );
  });

  it('routes Markdown Find and links through the active document authority', async () => {
    const onNavigate = vi.fn();
    const onOpenExternal = vi.fn(async () => true);
    const api = {
      load: vi.fn(async () => ({
        content:
          '# Plan\n\nFind this phrase.\n\n[Details](details.md#part)\n\n[Website](https://example.com/docs)',
        format: 'md' as const,
        version: 'v1',
      })),
      overwrite: vi.fn(),
      save: vi.fn(),
    };
    const { runtime } = renderSource(
      api,
      { folderPath: '/library/notes', path: 'guides/plan.md' },
      { onNavigate, onOpenExternal },
    );
    await screen.findByRole('heading', { name: 'Plan' }, { timeout: 5_000 });

    await waitFor(() => expect(runtime.navigation.store.getState().find.available).toBe(true));
    act(() => expect(runtime.navigation.openFind()).toBe(true));
    const input = await screen.findByRole('textbox', { name: 'Find in document' });
    expect(screen.getByRole('group', { name: 'Find matching options' })).not.toBeNull();
    expect(screen.getByRole('group', { name: 'Find result navigation' })).not.toBeNull();
    fireEvent.change(input, { target: { value: 'Find this phrase' } });
    await waitFor(() => expect(runtime.navigation.store.getState().find.total).toBe(1));

    fireEvent.click(screen.getByRole('link', { name: 'Details' }));
    expect(onNavigate).toHaveBeenCalledWith({
      anchor: 'part',
      source: { folderPath: '/library/notes', path: 'guides/details.md' },
    });
    fireEvent.click(screen.getByRole('link', { name: 'Website' }));
    await waitFor(() => expect(onOpenExternal).toHaveBeenCalledWith('https://example.com/docs'));
  });

  it('marks a source from another member folder as read-only', async () => {
    const api = {
      load: vi.fn(async () => ({ content: 'literal text', format: 'txt' as const, version: 'v1' })),
      overwrite: vi.fn(),
      save: vi.fn(),
    };
    renderSource(api, { folderPath: '/library/archive', path: 'notes.txt' });

    await screen.findByLabelText('notes.txt source');
    expect(screen.getByText('Read-only source from another library folder')).not.toBeNull();
    expect(
      screen
        .getByRole('region', { name: 'notes.txt document' })
        .querySelector('[data-document-access="read-only"]'),
    ).not.toBeNull();
  });

  it('keeps unsupported encoding explicit and retries in the same tab', async () => {
    const api = {
      load: vi
        .fn<DocumentSourceApi['load']>()
        .mockRejectedValueOnce(
          new DocumentSourceError(
            'unsupported-encoding',
            'This text file is not valid UTF-8. It remains unchanged and read-only.',
          ),
        )
        .mockResolvedValueOnce({ content: 'now utf-8', format: 'txt', version: 'v2' }),
      overwrite: vi.fn(),
      save: vi.fn(),
    };
    renderSource(api, { folderPath: '/library/notes', path: 'legacy.txt' });

    expect((await screen.findByRole('alert')).textContent).toContain(
      'This text file is not valid UTF-8. It remains unchanged and read-only.',
    );
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }));

    expect(((await screen.findByLabelText('legacy.txt source')) as HTMLTextAreaElement).value).toBe(
      'now utf-8',
    );
    expect(api.load).toHaveBeenCalledTimes(2);
  });

  it('aborts a pending source load when its tab closes', async () => {
    let capturedSignal: AbortSignal | null = null;
    const load = vi.fn<DocumentSourceApi['load']>();
    load.mockImplementation((_source, signal) => {
      capturedSignal = signal;
      return new Promise(() => {});
    });
    const api: DocumentSourceApi = { load, overwrite: vi.fn(), save: vi.fn() };
    const { runtime } = renderSource(api);
    await waitFor(() => expect(capturedSignal).not.toBeNull());

    await act(async () => {
      await runtime.close('tab-1');
    });

    await waitFor(() => expect(capturedSignal?.aborted).toBe(true));
  });

  it('marks edits immediately and autosaves with the accepted version', async () => {
    const api: DocumentSourceApi = {
      load: vi.fn<DocumentSourceApi['load']>(async () => ({
        content: 'before\r\n',
        format: 'txt',
        version: 'v1',
      })),
      overwrite: vi.fn(),
      save: vi.fn<DocumentSourceApi['save']>(async () => ({
        content: 'after\r\n',
        format: 'txt',
        version: 'v2',
      })),
    };
    const { runtime } = renderSource(api, {
      folderPath: '/library/notes',
      path: 'notes.txt',
    });
    const editor = (await screen.findByLabelText('notes.txt source')) as HTMLTextAreaElement;
    vi.useFakeTimers();

    fireEvent.change(editor, { target: { value: 'after\n' } });

    expect(runtime.getDocument('tab-1')?.store.getState().editor).toMatchObject({
      dirty: true,
      savePhase: 'unsaved',
      value: 'after\n',
      version: 'v1',
    });
    expect(screen.queryByText('Unsaved')).toBeNull();
    await act(async () => vi.advanceTimersByTimeAsync(499));
    expect(api.save).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(api.save).toHaveBeenCalledOnce();
    expect(api.save).toHaveBeenCalledWith(
      { folderPath: '/library/notes', path: 'notes.txt' },
      { baseVersion: 'v1', content: 'after\n' },
      expect.any(AbortSignal),
    );
    expect(runtime.getDocument('tab-1')?.store.getState().editor?.savePhase).toBe('saved');
    expect(screen.queryByText('Saved')).toBeNull();
    expect((screen.getByLabelText('notes.txt source') as HTMLTextAreaElement).value).toBe(
      'after\n',
    );
  });

  it('keeps failed saves editable and offers retry without another toolbar', async () => {
    const api: DocumentSourceApi = {
      load: vi.fn<DocumentSourceApi['load']>(async () => ({
        content: 'before',
        format: 'txt',
        version: 'v1',
      })),
      overwrite: vi.fn(),
      save: vi
        .fn<DocumentSourceApi['save']>()
        .mockRejectedValueOnce(new Error('offline'))
        .mockResolvedValueOnce({ content: 'draft', format: 'txt', version: 'v2' }),
    };
    const { runtime } = renderSource(api, { folderPath: '/library/notes', path: 'plan.txt' });
    const editor = (await screen.findByLabelText('plan.txt source')) as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: 'draft' } });

    await waitFor(() => expect(screen.getByRole('button', { name: 'Retry' })).not.toBeNull(), {
      timeout: 2_000,
    });
    expect(editor.value).toBe('draft');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() =>
      expect(runtime.getDocument('tab-1')?.store.getState().editor?.savePhase).toBe('saved'),
    );
    expect(screen.queryByText('Saved')).toBeNull();
    expect(api.save).toHaveBeenCalledTimes(2);
  });

  it('compares both conflict versions and turns merge into an editable draft', async () => {
    const api: DocumentSourceApi = {
      load: vi
        .fn<DocumentSourceApi['load']>()
        .mockResolvedValueOnce({ content: 'shared\nbefore', format: 'txt', version: 'v1' })
        .mockResolvedValueOnce({ content: 'shared\ndisk change', format: 'txt', version: 'v2' }),
      overwrite: vi.fn(),
      save: vi
        .fn<DocumentSourceApi['save']>()
        .mockRejectedValueOnce(
          new DocumentSaveError('conflict', 'changed', { currentVersion: 'v2' }),
        )
        .mockResolvedValue({ content: 'merged', format: 'txt', version: 'v3' }),
    };
    const { runtime } = renderSource(api, { folderPath: '/library/notes', path: 'plan.txt' });
    const editor = (await screen.findByLabelText('plan.txt source')) as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: 'shared\neditor change' } });

    await act(async () => {
      await runtime.getDocument('tab-1')?.save(api);
    });

    expect(await screen.findByRole('heading', { name: 'plan.txt changed on disk' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Reload' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Merge' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Overwrite' })).not.toBeNull();
    expect(screen.getByText('disk change')).not.toBeNull();
    expect(screen.getByText('editor change')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Merge' }));
    const merged = (await screen.findByLabelText('plan.txt source')) as HTMLTextAreaElement;
    expect(merged.value).toContain('<<<<<<< Editor Version\neditor change');
    expect(merged.value).toContain('=======\ndisk change\n>>>>>>> Disk Version');
    expect(runtime.getDocument('tab-1')?.store.getState().editor).toMatchObject({
      conflict: null,
      dirty: true,
      version: 'v2',
    });
  });
});
