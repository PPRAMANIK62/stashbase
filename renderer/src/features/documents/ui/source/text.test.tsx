import { act, cleanup, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { createDocumentRuntime } from '@/features/documents/application/document-runtime';
import { DOCUMENT_SOURCE_MESSAGES } from '@/features/documents/application/failure-messages';
import {
  DocumentSourceError,
  type DocumentSourcePort,
} from '@/features/documents/application/ports';
import { createDocumentQueryScope } from '@/features/documents/application/queries';
import { sourceApi, textSource } from '@/test/fakes/documents';
import { createTestQueryClient, withQueryClient } from '@/test/query';

import { TextSurface } from './text';

const runtimes: ReturnType<typeof createDocumentRuntime>[] = [];

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  for (const runtime of runtimes.splice(0)) runtime.dispose();
});

function renderSurface(
  api: DocumentSourcePort,
  source = { folderPath: '/library/notes', path: 'plan.txt' },
) {
  const queryClient = createTestQueryClient();
  const runtime = createDocumentRuntime({
    activeFolderPath: '/library/notes',
    generation: 1,
    id: 'tab-1',
    queries: createDocumentQueryScope(queryClient, {
      generation: 1,
      id: 'tab-1',
      source,
    }),
    source,
  });
  runtimes.push(runtime);
  withQueryClient(
    <TextSurface
      active
      editorLabel="text editor"
      name="plan.txt"
      runtime={runtime}
      sourceApi={api}
      status={({ error, name, retry }) =>
        error === undefined ? (
          <p data-testid="status">Loading {name}</p>
        ) : (
          <button data-testid="status-retry" onClick={retry} type="button">
            Reload {name}
          </button>
        )
      }
    >
      {({ editor, readOnly, value }) => (
        <textarea
          aria-label="plan.txt body"
          data-read-only={readOnly}
          data-save-kind={editor?.save.kind ?? 'none'}
          onChange={() => undefined}
          value={value}
        />
      )}
    </TextSurface>,
    queryClient,
  );
  return runtime;
}

describe('text document surface', () => {
  it('shows the format status panel until the source lands', async () => {
    renderSurface(sourceApi({ load: vi.fn(() => new Promise<never>(() => undefined)) }));

    expect(screen.getByTestId('status').textContent).toBe('Loading plan.txt');
    expect(screen.queryByLabelText('plan.txt body')).toBeNull();
  });

  it('reports a refused load with the sentence the error carries', async () => {
    const api = sourceApi({
      load: vi
        .fn<DocumentSourcePort['load']>()
        .mockRejectedValue(
          new DocumentSourceError('unsupported-encoding', 'byte 0x80 at offset 12'),
        ),
    });
    renderSurface(api);

    expect((await screen.findByRole('alert')).textContent).toContain(
      DOCUMENT_SOURCE_MESSAGES['unsupported-encoding'],
    );
    expect(screen.getByRole('heading', { name: 'Could not open plan.txt' })).not.toBeNull();
  });

  it('falls back to the family sentence for a rejection that is not a source failure', async () => {
    renderSurface(
      sourceApi({
        load: vi.fn<DocumentSourcePort['load']>().mockRejectedValue(new Error('socket')),
      }),
    );

    expect((await screen.findByRole('alert')).textContent).toBe(
      'The document could not be loaded. Your source file has not been changed.',
    );
  });

  it('marks a source from another folder read-only and never opens an editor session', async () => {
    const runtime = renderSurface(
      sourceApi({ load: vi.fn(async () => textSource({ content: 'read me', format: 'txt' })) }),
      { folderPath: '/library/archive', path: 'plan.txt' },
    );

    const body = await screen.findByLabelText('plan.txt body');
    expect(body.getAttribute('data-read-only')).toBe('true');
    expect(screen.getByText('Read-only source from another library folder')).not.toBeNull();
    expect(runtime.store.getState().editor).toBeNull();
  });

  it('surfaces a failed save with a retry and clears it once the save lands', async () => {
    const api = sourceApi({
      load: vi.fn(async () => textSource({ content: 'before', format: 'txt' })),
      save: vi
        .fn<DocumentSourcePort['save']>()
        .mockRejectedValueOnce(new Error('offline'))
        .mockResolvedValueOnce(textSource({ content: 'after', format: 'txt', version: 'v2' })),
    });
    const runtime = renderSurface(api);
    await screen.findByLabelText('plan.txt body');

    act(() => runtime.change('after'));
    await act(async () => {
      await runtime.save(api);
    });

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe(
      'The document could not be saved. Your changes are still available.',
    );
    expect(screen.getByLabelText('plan.txt body').getAttribute('data-save-kind')).toBe('failed');

    await act(async () => {
      await runtime.save(api);
    });
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(screen.getByLabelText('plan.txt body').getAttribute('data-save-kind')).toBe('saved');
  });

  it('reports an index warning as a status rather than a failure', async () => {
    const api = sourceApi({
      load: vi.fn(async () => textSource({ content: 'before', format: 'txt' })),
      save: vi.fn(async () => ({
        content: 'after',
        format: 'txt' as const,
        indexWarning: 'Saved, but the index did not update.',
        version: 'v2',
      })),
    });
    const runtime = renderSurface(api);
    await screen.findByLabelText('plan.txt body');

    act(() => runtime.change('after'));
    await act(async () => {
      await runtime.save(api);
    });

    const status = await screen.findByText('Saved, but the index did not update.');
    expect(status.getAttribute('role')).toBe('status');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('hands a version conflict to the comparison view instead of the editor', async () => {
    const api = sourceApi({
      load: vi.fn(async () => textSource({ content: 'shared', format: 'txt' })),
    });
    const runtime = renderSurface(api);
    await screen.findByLabelText('plan.txt body');

    act(() => runtime.change('editor draft'));
    act(() => {
      runtime.store.setState((state) => ({
        ...state,
        editor: state.editor && {
          ...state.editor,
          save: {
            conflict: {
              diskContent: 'disk draft',
              diskVersion: 'v2',
              editorContent: 'editor draft',
              resolutionMessage: null,
              resolving: null,
            },
            kind: 'conflict',
          },
        },
      }));
    });

    expect(await screen.findByRole('heading', { name: 'plan.txt changed on disk' })).not.toBeNull();
    expect(screen.queryByLabelText('plan.txt body')).toBeNull();
  });
});
