import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import {
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
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const runtime = createDocumentTabsRuntime({
    createId: () => 'tab-1',
    createQueries: (scope) => createDocumentQueryScope(queryClient, scope),
    folderPath: '/library/notes',
    generation: 1,
  });
  runtime.open(source);
  runtimes.push(runtime);
  render(
    <QueryClientProvider client={queryClient}>
      <DocumentWorkspace api={api} runtime={runtime} />
    </QueryClientProvider>,
  );
  return { queryClient, runtime };
}

describe('document text source', () => {
  it('loads and presents versioned Markdown as source text', async () => {
    const api = {
      load: vi.fn(async () => ({
        content: '# Plan\n\n- Keep the source',
        format: 'md' as const,
        version: 'sha256:abc',
      })),
    };
    renderSource(api);

    expect(screen.getByRole('status').textContent).toContain('Loading plan.md');
    const source = await screen.findByLabelText('plan.md source');

    expect(source.textContent).toBe('# Plan\n\n- Keep the source');
    expect(screen.queryByRole('heading', { name: 'Plan' })).toBeNull();
    expect(api.load).toHaveBeenCalledWith(
      { folderPath: '/library/notes', path: 'plan.md' },
      expect.any(AbortSignal),
    );
  });

  it('marks a source from another member folder as read-only', async () => {
    const api = {
      load: vi.fn(async () => ({ content: 'literal text', format: 'txt' as const, version: 'v1' })),
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
    };
    renderSource(api, { folderPath: '/library/notes', path: 'legacy.txt' });

    expect((await screen.findByRole('alert')).textContent).toContain(
      'This text file is not valid UTF-8. It remains unchanged and read-only.',
    );
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }));

    expect((await screen.findByLabelText('legacy.txt source')).textContent).toContain('now utf-8');
    expect(api.load).toHaveBeenCalledTimes(2);
  });

  it('aborts a pending source load when its tab closes', async () => {
    let capturedSignal: AbortSignal | null = null;
    const load = vi.fn<DocumentSourceApi['load']>();
    load.mockImplementation((_source, signal) => {
      capturedSignal = signal;
      return new Promise(() => {});
    });
    const api: DocumentSourceApi = { load };
    const { runtime } = renderSource(api);
    await waitFor(() => expect(capturedSignal).not.toBeNull());

    act(() => runtime.close('tab-1'));

    await waitFor(() => expect(capturedSignal?.aborted).toBe(true));
  });
});
