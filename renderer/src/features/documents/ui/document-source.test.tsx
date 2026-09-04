import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  DocumentSaveError,
  DocumentSourceError,
  GenericFilePreviewError,
  type DocumentSourceApi,
  type GenericFilePreviewApi,
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
    genericPreviewApi?: GenericFilePreviewApi;
    onNavigate?: Parameters<typeof DocumentWorkspace>[0]['onNavigate'];
    onOpenExternal?: Parameters<typeof DocumentWorkspace>[0]['onOpenExternal'];
    onReveal?: Parameters<typeof DocumentWorkspace>[0]['onReveal'];
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
      <DocumentWorkspace
        genericPreviewApi={
          options.genericPreviewApi ?? {
            load: vi.fn(() => new Promise<never>(() => undefined)),
          }
        }
        onNavigate={options.onNavigate}
        onOpenExternal={options.onOpenExternal}
        onReveal={options.onReveal ?? vi.fn(async () => undefined)}
        revealLabel="Show in file manager"
        runtime={runtime}
        sourceApi={api}
      />
    </QueryClientProvider>,
  );
  return { queryClient, runtime };
}

function codeEditor(label: string): EditorView {
  const content = screen.getByLabelText(label);
  const editor = content.closest<HTMLElement>('.cm-editor');
  const view = editor ? EditorView.findFromDOM(editor) : null;
  if (!view) throw new Error(`Could not find CodeMirror editor for ${label}.`);
  return view;
}

describe('document text source', () => {
  it('opens generic UTF-8 code in the shared read-only editor with Find', async () => {
    const api: DocumentSourceApi = {
      load: vi.fn(),
      overwrite: vi.fn(),
      save: vi.fn(),
    };
    const genericPreviewApi: GenericFilePreviewApi = {
      load: vi.fn<GenericFilePreviewApi['load']>(async () => ({
        content: 'export const answer = 42;\n',
        kind: 'text',
        name: 'src/answer.ts',
        size: 26,
        version: 'v1',
      })),
    };
    const { runtime } = renderSource(
      api,
      { folderPath: '/library/notes', path: 'src/answer.ts' },
      { genericPreviewApi },
    );

    await screen.findByLabelText('Read-only answer.ts source');
    const editor = codeEditor('Read-only answer.ts source');
    expect(editor.state.facet(EditorState.readOnly)).toBe(true);
    expect(editor.state.doc.toString()).toBe('export const answer = 42;\n');
    expect(api.load).not.toHaveBeenCalled();
    expect(genericPreviewApi.load).toHaveBeenCalledWith(
      { folderPath: '/library/notes', path: 'src/answer.ts' },
      expect.any(AbortSignal),
    );

    await waitFor(() => expect(runtime.navigation.store.getState().find.available).toBe(true));
    act(() => runtime.navigation.setFindQuery('answer'));
    await waitFor(() =>
      expect(runtime.navigation.store.getState().find).toMatchObject({ current: 1, total: 1 }),
    );
  });

  it('shows generic refusal metadata and reveals the exact source', async () => {
    const api: DocumentSourceApi = { load: vi.fn(), overwrite: vi.fn(), save: vi.fn() };
    const onReveal = vi.fn(async () => undefined);
    renderSource(
      api,
      { folderPath: '/library/archive', path: 'assets/payload.bin' },
      {
        genericPreviewApi: {
          load: vi.fn<GenericFilePreviewApi['load']>(async () => ({
            kind: 'binary',
            name: 'assets/payload.bin',
            size: 1_250,
          })),
        },
        onReveal,
      },
    );

    expect(await screen.findByText('Binary file cannot be opened')).not.toBeNull();
    expect(screen.getByText('assets/payload.bin · 1.3 kB')).not.toBeNull();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Show in file manager' }));
    expect(onReveal).toHaveBeenCalledWith(
      { folderPath: '/library/archive', path: 'assets/payload.bin' },
      expect.any(AbortSignal),
    );
  });

  it('keeps pending format-specific viewers distinct from generic failures', async () => {
    renderSource(
      { load: vi.fn(), overwrite: vi.fn(), save: vi.fn() },
      { folderPath: '/library/notes', path: 'report.pdf' },
      {
        genericPreviewApi: {
          load: vi.fn<GenericFilePreviewApi['load']>(async () => {
            throw new GenericFilePreviewError(
              'not-generic',
              'This file belongs to a format-specific viewer.',
            );
          }),
        },
      },
    );

    expect(await screen.findByText('This document viewer is not available yet.')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });

  it('opens strict JSON as a source-preserving tree and saves a structural edit', async () => {
    const original = '\uFEFF{\r\n  "title" : "before",\r\n  "items": [1, 2]\r\n}\r\n';
    const api: DocumentSourceApi = {
      load: vi.fn(async () => ({ content: original, format: 'json' as const, version: 'v1' })),
      overwrite: vi.fn(),
      save: vi.fn(async (_source, input) => ({
        content: input.content.replace(/\n/gu, '\r\n'),
        format: 'json' as const,
        version: 'v2',
      })),
    };
    const { runtime } = renderSource(api, {
      folderPath: '/library/notes',
      path: 'data.json',
    });

    const outlinePane = await screen.findByRole('region', { name: 'JSON outline' });
    const sourcePane = screen.getByRole('region', { name: 'JSON source' });
    const structureTable = screen.getByRole('treegrid', { name: 'JSON values' });
    expect(structureTable.tagName).toBe('TABLE');
    expect(screen.getByRole('columnheader', { name: 'Key' })).not.toBeNull();
    expect(screen.getByRole('columnheader', { name: 'Value' })).not.toBeNull();
    expect(screen.getByRole('columnheader', { name: 'Type' })).not.toBeNull();
    const previewLabel = screen.getByText('Preview');
    const sourceLabel = screen.getByText('Source');
    expect(previewLabel.className).toBe(sourceLabel.className);
    expect(screen.queryByRole('button', { name: 'Selected value actions' })).toBeNull();
    expect(sourcePane.querySelector('.cm-editor')).not.toBeNull();
    expect(screen.queryByPlaceholderText('Search tree')).toBeNull();
    expect(screen.getByRole('row', { name: /^title/u }).textContent).not.toContain('"before"');

    const initialTreeTabStop = structureTable.querySelector<HTMLElement>('tr[tabindex="0"]');
    expect(initialTreeTabStop?.textContent).toContain('Root');
    if (initialTreeTabStop) fireEvent.keyDown(initialTreeTabStop, { key: 'ArrowDown' });
    expect(screen.getByRole('row', { name: /^title/u }).getAttribute('aria-selected')).toBe('true');

    await waitFor(() => expect(runtime.navigation.store.getState().find.available).toBe(true));
    act(() => runtime.navigation.setFindQuery('before'));
    await waitFor(() => expect(runtime.navigation.store.getState().find.total).toBe(1));
    expect(runtime.getDocument('tab-1')?.store.getState().jsonSession.selectedPath).toBe('$.title');

    const sourceContent = sourcePane.querySelector<HTMLElement>('.cm-content');
    expect(sourceContent).not.toBeNull();
    if (sourceContent) fireEvent.focus(sourceContent);
    await waitFor(() =>
      expect(runtime.getDocument('tab-1')?.store.getState().jsonSession.viewMode).toBe('source'),
    );
    expect(screen.getByRole('region', { name: 'JSON outline' })).toBe(outlinePane);
    expect(screen.getByRole('region', { name: 'JSON source' })).toBe(sourcePane);

    const titleRow = screen.getByRole('row', { name: /^title/u });
    const titleValueCell = titleRow.querySelectorAll('td')[1];
    expect(titleValueCell).toBeDefined();
    const ownerDocument = titleValueCell?.ownerDocument;
    expect(ownerDocument).toBeDefined();
    if (!ownerDocument) throw new Error('The value cell must belong to a document.');
    const caretDescriptor = Object.getOwnPropertyDescriptor(
      ownerDocument,
      'caretPositionFromPoint',
    );
    Object.defineProperty(ownerDocument, 'caretPositionFromPoint', {
      configurable: true,
      value: () => ({ offset: 2, offsetNode: titleValueCell?.firstChild }),
    });
    if (titleValueCell) fireEvent.doubleClick(titleValueCell, { clientX: 24, clientY: 12 });
    if (caretDescriptor)
      Object.defineProperty(ownerDocument, 'caretPositionFromPoint', caretDescriptor);
    else Reflect.deleteProperty(ownerDocument, 'caretPositionFromPoint');
    await waitFor(() =>
      expect(runtime.getDocument('tab-1')?.store.getState().jsonSession.viewMode).toBe('tree'),
    );
    expect(screen.getByRole('region', { name: 'JSON outline' })).toBe(outlinePane);
    expect(screen.getByRole('region', { name: 'JSON source' })).toBe(sourcePane);
    const inlineValue = await screen.findByLabelText('JSON value');
    expect(inlineValue.closest('[data-json-inline-editor]')).not.toBeNull();
    expect((inlineValue as HTMLInputElement).value).toBe('before');
    expect((inlineValue as HTMLInputElement).selectionStart).toBe(2);
    expect((inlineValue as HTMLInputElement).selectionEnd).toBe(2);
    expect(inlineValue.classList.contains('rounded-none')).toBe(true);
    fireEvent.change(inlineValue, { target: { value: 'after' } });
    vi.useFakeTimers();
    fireEvent.keyDown(inlineValue, { key: 'Enter' });
    expect(screen.queryByLabelText('JSON value')).toBeNull();

    expect(runtime.getDocument('tab-1')?.store.getState().editor).toMatchObject({
      dirty: true,
      value: '\uFEFF{\n  "title" : "after",\n  "items": [1, 2]\n}\n',
    });
    await act(async () => vi.advanceTimersByTimeAsync(500));
    expect(api.save).toHaveBeenCalledWith(
      { folderPath: '/library/notes', path: 'data.json' },
      {
        baseVersion: 'v1',
        content: '\uFEFF{\n  "title" : "after",\n  "items": [1, 2]\n}\n',
      },
      expect.any(AbortSignal),
    );
  });

  it('keeps malformed JSON editable in Source mode with an actionable reason', async () => {
    const api: DocumentSourceApi = {
      load: vi.fn(async () => ({
        content: '{"unfinished":',
        format: 'json' as const,
        version: 'v1',
      })),
      overwrite: vi.fn(),
      save: vi.fn(),
    };
    const { runtime } = renderSource(api, {
      folderPath: '/library/notes',
      path: 'unfinished.json',
    });

    const json = await screen.findByRole('document', { name: 'unfinished.json JSON content' });
    await waitFor(() => expect(json.getAttribute('data-json-active-pane')).toBe('source'));
    expect(screen.getByRole('region', { name: 'JSON outline' })).not.toBeNull();
    expect(screen.getByText('Invalid JSON · line 1, column 15')).not.toBeNull();
    expect(json.querySelector('.cm-editor')).not.toBeNull();
    await waitFor(() => expect(runtime.navigation.store.getState().find.available).toBe(true));
    act(() => runtime.navigation.setFindQuery('unfinished'));
    await waitFor(() => expect(runtime.navigation.store.getState().find.total).toBe(1));
  });

  it('adds and renames object properties in place', async () => {
    const api: DocumentSourceApi = {
      load: vi.fn(async () => ({
        content: '{"name":"Ada"}',
        format: 'json' as const,
        version: 'v1',
      })),
      overwrite: vi.fn(),
      save: vi.fn(async (_source, input) => ({
        content: input.content,
        format: 'json' as const,
        version: 'v2',
      })),
    };
    const { runtime } = renderSource(api, {
      folderPath: '/library/notes',
      path: 'person.json',
    });

    await screen.findByRole('treegrid', { name: 'JSON values' });
    fireEvent.click(screen.getByRole('button', { name: 'Add property' }));
    const key = screen.getByLabelText('New property key');
    const value = screen.getByLabelText('New JSON value');
    const addRow = key.closest('[data-json-inline-editor]');
    expect(addRow).toBe(value.closest('[data-json-inline-editor]'));
    expect(addRow).toBe(screen.getByRole('treegrid').querySelector('tbody tr:last-child'));
    expect(key.classList.contains('rounded-none')).toBe(true);
    expect(value.classList.contains('rounded-none')).toBe(true);
    fireEvent.change(key, { target: { value: 'count' } });
    fireEvent.change(value, { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add value' }));

    const countRow = await screen.findByRole('row', { name: /^count/u });
    expect(runtime.getDocument('tab-1')?.store.getState().editor?.value).toBe(
      '{"name":"Ada","count":1}',
    );

    fireEvent.click(countRow);
    fireEvent.keyDown(countRow, { key: 'F2' });
    const renamedKey = await screen.findByLabelText('Key');
    expect(renamedKey.closest('[data-json-inline-editor]')).not.toBeNull();
    fireEvent.change(renamedKey, { target: { value: 'total' } });
    fireEvent.keyDown(renamedKey, { key: 'Enter' });

    expect(runtime.getDocument('tab-1')?.store.getState().editor?.value).toBe(
      '{"name":"Ada","total":1}',
    );

    const totalRow = screen.getByRole('row', { name: /^total/u });
    const deleteTotal = screen.getByRole('button', { name: 'Delete total' });
    expect(totalRow.getAttribute('aria-keyshortcuts')).toBe('Delete');
    expect(deleteTotal.classList.contains('opacity-0')).toBe(true);
    expect(deleteTotal.classList.contains('text-destructive')).toBe(true);
    fireEvent.click(deleteTotal);
    expect(runtime.getDocument('tab-1')?.store.getState().editor?.value).toBe('{"name":"Ada"}');
  });

  it('adds plain table text as a JSON string without exposing source-mode errors', async () => {
    const api: DocumentSourceApi = {
      load: vi.fn(async () => ({
        content: '{"name":"Ada"}',
        format: 'json' as const,
        version: 'v1',
      })),
      overwrite: vi.fn(),
      save: vi.fn(),
    };
    const { runtime } = renderSource(api, {
      folderPath: '/library/notes',
      path: 'person.json',
    });

    await screen.findByRole('treegrid', { name: 'JSON values' });
    fireEvent.click(screen.getByRole('button', { name: 'Add property' }));
    fireEvent.change(screen.getByLabelText('New property key'), {
      target: { value: 'portfolio' },
    });
    fireEvent.change(screen.getByLabelText('New JSON value'), {
      target: { value: 'purbayan.me' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add value' }));

    expect(runtime.getDocument('tab-1')?.store.getState().editor?.value).toBe(
      '{"name":"Ada","portfolio":"purbayan.me"}',
    );
    expect(screen.queryByRole('alert')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Add property' }));
    fireEvent.change(screen.getByLabelText('New property key'), {
      target: { value: 'details' },
    });
    fireEvent.change(screen.getByLabelText('New JSON value'), { target: { value: '{bad' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add value' }));

    expect(screen.getByRole('alert').textContent).toContain('Invalid JSON value:');
    expect(screen.getByRole('alert').textContent).not.toContain('Source mode');
    expect(runtime.getDocument('tab-1')?.store.getState().editor?.value).toBe(
      '{"name":"Ada","portfolio":"purbayan.me"}',
    );
  });

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

    await screen.findByLabelText('legacy.txt source');
    expect(codeEditor('legacy.txt source').state.doc.toString()).toBe('now utf-8');
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
    await screen.findByLabelText('notes.txt source');
    const editor = codeEditor('notes.txt source');
    vi.useFakeTimers();

    editor.dispatch({ changes: { from: 0, insert: 'after\n', to: editor.state.doc.length } });

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
    expect(codeEditor('notes.txt source').state.doc.toString()).toBe('after\n');
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
    await screen.findByLabelText('plan.txt source');
    const editor = codeEditor('plan.txt source');
    editor.dispatch({ changes: { from: 0, insert: 'draft', to: editor.state.doc.length } });

    await waitFor(() => expect(screen.getByRole('button', { name: 'Retry' })).not.toBeNull(), {
      timeout: 2_000,
    });
    expect(editor.state.doc.toString()).toBe('draft');
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
    await screen.findByLabelText('plan.txt source');
    const editor = codeEditor('plan.txt source');
    editor.dispatch({
      changes: { from: 0, insert: 'shared\neditor change', to: editor.state.doc.length },
    });

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
    await screen.findByLabelText('plan.txt source');
    const merged = codeEditor('plan.txt source').state.doc.toString();
    expect(merged).toContain('<<<<<<< Editor Version\neditor change');
    expect(merged).toContain('=======\ndisk change\n>>>>>>> Disk Version');
    expect(runtime.getDocument('tab-1')?.store.getState().editor).toMatchObject({
      conflict: null,
      dirty: true,
      version: 'v2',
    });
  });
});
