import { EditorView } from '@codemirror/view';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import type { AppDependencies } from '@/app/dependencies';
import { Providers } from '@/app/providers';
import { App } from '@/app/shell';
import type { AgentSessionPort } from '@/features/agent/public';
import { DocumentSaveError } from '@/features/documents/test-support';
import {
  agentCatalogPort,
  agentInstructionsApi,
  agentSessionPort,
  BUILT_IN_AGENT,
  pendingAgentContextPort,
} from '@/test/fakes/agent';
import { appDependencies, captureBridge } from '@/test/fakes/app';
import { documentAdapters, documentsApi, sourceApi } from '@/test/fakes/documents';
import { preparationControlApi, preparationStatusApi } from '@/test/fakes/preparation';
import { agentRuntime, agentRuntimePort } from '@/test/fakes/settings';
import {
  filesApi,
  libraryApi,
  librarySnapshot,
  listing,
  workspaceAdapters,
} from '@/test/fakes/workspace';

/**
 * J07 "Converge chat into a document" at the renderer composition boundary:
 * an Agent write beside an open document refreshes the workspace without
 * taking the user's place, offers the changed file behind an explicit Open,
 * and reaches the versioned conflict once the Canvas holds unsaved edits.
 */

interface FakeMarkdownEditor {
  change: ((context: unknown, markdown: string, previous: string) => void) | null;
  markdown: string;
  root: HTMLElement;
  status: string;
}

const editors = vi.hoisted(() => ({ instances: [] as FakeMarkdownEditor[] }));

vi.mock('@milkdown/kit/utils', () => ({
  replaceAll: (markdown: string) => ({ markdown }),
}));

vi.mock('@milkdown/crepe/builder', () => ({
  CrepeBuilder: class FakeCrepeBuilder {
    readonly instance: FakeMarkdownEditor;

    editor: { action: (payload: unknown) => unknown; status: string };

    constructor({ defaultValue, root }: { defaultValue: string; root: HTMLElement }) {
      const instance: FakeMarkdownEditor = {
        change: null,
        markdown: defaultValue,
        root,
        status: 'OnCreate',
      };
      this.instance = instance;
      editors.instances.push(instance);
      this.editor = {
        action: (payload: unknown) => {
          if (payload && typeof payload === 'object' && 'markdown' in payload) {
            instance.markdown = String((payload as { markdown: unknown }).markdown);
          }
          return null;
        },
        get status() {
          return instance.status;
        },
      };
    }

    addFeature() {
      return this;
    }

    async create() {
      this.instance.status = 'Created';
    }

    async destroy() {
      this.instance.status = 'Destroyed';
    }

    getMarkdown() {
      return this.instance.markdown;
    }

    on(
      register: (listener: {
        markdownUpdated(callback: FakeMarkdownEditor['change']): void;
      }) => void,
    ) {
      register({ markdownUpdated: (callback) => (this.instance.change = callback) });
      return this;
    }

    setReadonly() {
      return this;
    }
  },
}));

type AgentConnectionListener = Parameters<AgentSessionPort['connect']>[1];

const FOLDER = '/library/notes';

interface Harness {
  dependencies: AppDependencies;
  listeners: AgentConnectionListener[];
  saves: Array<{ path: string; content: string }>;
  setFiles(paths: string[]): void;
  setSource(path: string, content: string, version: string): void;
  setSaveConflict(conflict: boolean): void;
}

function harness(): Harness {
  const saves: Array<{ path: string; content: string }> = [];
  const sources = new Map<string, { content: string; format: 'md'; version: string }>([
    ['Welcome.md', { content: '# Welcome', format: 'md', version: 'w1' }],
    ['Canvas.md', { content: '# Canvas v1', format: 'md', version: 'c1' }],
  ]);
  let files = ['Welcome.md'];
  let saveConflict = false;
  let nextId = 0;
  const session = agentSessionPort();
  const base = appDependencies();

  const dependencies = appDependencies({
    agent: {
      catalog: agentCatalogPort([BUILT_IN_AGENT]),
      context: pendingAgentContextPort(),
      instructions: agentInstructionsApi(),
      session: session.port,
    },
    capture: captureBridge(),
    documents: documentsApi({
      adapters: documentAdapters({
        source: sourceApi({
          load: vi.fn(async (source) => {
            const text = sources.get(source.path);
            if (!text) throw new Error(`No source for ${source.path}`);
            return { ...text };
          }),
          save: vi.fn(async (source, input) => {
            if (saveConflict) {
              throw new DocumentSaveError('conflict', 'changed', { currentVersion: 'c3' });
            }
            saves.push({ content: input.content, path: source.path });
            const next = { content: input.content, format: 'md' as const, version: 'saved' };
            sources.set(source.path, next);
            return next;
          }),
        }),
      }),
      createId: vi.fn(() => `id-${++nextId}`),
    }),
    library: {
      api: libraryApi({
        load: vi.fn(async () =>
          librarySnapshot({
            activeFolder: { name: 'Notes', path: FOLDER },
            members: [{ favorite: false, openedAt: '2026-09-02T00:00:00.000Z', path: FOLDER }],
          }),
        ),
      }),
      folderPicker: base.library.folderPicker,
      lifecycle: base.library.lifecycle,
    },
    preparation: {
      controlApi: preparationControlApi({ reprocess: vi.fn(async () => 'index' as const) }),
      // The status route never settles here: this journey is about the Agent
      // write reaching the tree, not about preparation reporting on it.
      statusApi: preparationStatusApi({ load: vi.fn(() => new Promise<never>(() => undefined)) }),
    },
    settings: {
      ...base.settings,
      agentRuntimeApi: agentRuntimePort({
        getAllowance: vi.fn(() => new Promise<never>(() => undefined)),
        listAgents: vi.fn(async () => ({ debug: null, runtimes: [agentRuntime()] })),
      }),
    },
    workspace: {
      adapters: workspaceAdapters({
        ...base.workspace.adapters,
        files: filesApi({ load: vi.fn(async () => listing(files, [], 'Notes')) }),
      }),
      revealLabel: 'Show in file manager',
    },
  });

  return {
    dependencies,
    listeners: session.listeners,
    saves,
    setFiles: (next) => void (files = next),
    setSaveConflict: (conflict) => void (saveConflict = conflict),
    setSource: (path, content, version) =>
      void sources.set(path, { content, format: 'md', version }),
  };
}

async function messageEditor(): Promise<EditorView> {
  const field = await screen.findByRole('textbox', { name: 'Message' }, { timeout: 5_000 });
  const view = EditorView.findFromDOM(field.closest('.cm-editor') as HTMLElement);
  if (!view) throw new Error('No CodeMirror view behind the message field.');
  return view;
}

function markdownEditorFor(name: string): FakeMarkdownEditor {
  const surface = screen.getByRole('document', { name: `${name} Markdown content` });
  let instance: FakeMarkdownEditor | undefined;
  for (const editor of editors.instances) {
    if (surface.contains(editor.root)) instance = editor;
  }
  if (!instance) throw new Error(`No Markdown editor mounted for ${name}.`);
  return instance;
}

/** Opens Welcome.md, connects the Agent, and returns its live listener. */
async function converge(test: Harness): Promise<AgentConnectionListener> {
  render(
    <Providers>
      <App dependencies={test.dependencies} />
    </Providers>,
  );

  const user = userEvent.setup();
  await user.click(await screen.findByRole('treeitem', { name: 'Welcome.md' }));
  await screen.findByRole('tab', { name: 'Welcome.md' });

  const composer = await messageEditor();
  act(() => {
    composer.dispatch({
      changes: { from: 0, insert: 'Draft the Canvas' },
      selection: { anchor: 16 },
    });
  });
  await user.click(screen.getByRole('button', { name: 'Send' }));

  const listener = test.listeners[0];
  if (!listener) throw new Error('The Agent session never connected.');
  act(() => listener.onEvent({ kind: 'ready' }));
  return listener;
}

/** One settled Write, as the runtime reports it. */
function settleWrite(listener: AgentConnectionListener, id: string, path: string, content: string) {
  act(() => {
    listener.onEvent({
      id,
      input: { content, file_path: path },
      kind: 'tool-started',
      name: 'Write',
    });
    listener.onEvent({ content: 'ok', id, isError: false, kind: 'tool-finished' });
  });
}

afterEach(() => {
  cleanup();
  editors.instances.length = 0;
  delete document.body.dataset.bootSettled;
});

describe('J07 converge chat into a document', () => {
  it('shows an Agent-written Canvas without taking the open document or focus', async () => {
    const test = harness();
    const listener = await converge(test);
    const focusedBefore = document.activeElement;

    test.setFiles(['Welcome.md', 'Canvas.md']);
    settleWrite(listener, 'write-1', 'Canvas.md', '# Canvas v1');

    expect(await screen.findByRole('treeitem', { name: 'Canvas.md' })).not.toBeNull();
    expect(screen.getByRole('tab', { name: 'Welcome.md' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(screen.queryByRole('tab', { name: 'Canvas.md' })).toBeNull();
    // The write must not pull focus out of wherever the user left it.
    expect(document.activeElement).toBe(focusedBefore);
    expect(test.dependencies.preparation.controlApi.sync).toHaveBeenCalledWith(
      FOLDER,
      expect.any(AbortSignal),
    );
  });

  it('opens the changed Canvas only when asked and adopts newer disk text', async () => {
    const test = harness();
    const listener = await converge(test);

    test.setFiles(['Welcome.md', 'Canvas.md']);
    settleWrite(listener, 'write-1', 'Canvas.md', '# Canvas v1');

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Open Canvas.md' }));

    expect(await screen.findByRole('tab', { name: 'Canvas.md' })).not.toBeNull();
    await waitFor(() => expect(markdownEditorFor('Canvas.md').markdown).toBe('# Canvas v1'));

    test.setSource('Canvas.md', '# Canvas v2', 'c2');
    settleWrite(listener, 'write-2', 'Canvas.md', '# Canvas v2');

    await waitFor(() => expect(markdownEditorFor('Canvas.md').markdown).toBe('# Canvas v2'));
  });

  it('meets the versioned conflict when the Canvas holds unsaved edits', async () => {
    const test = harness();
    const listener = await converge(test);

    test.setFiles(['Welcome.md', 'Canvas.md']);
    settleWrite(listener, 'write-1', 'Canvas.md', '# Canvas v1');
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Open Canvas.md' }));
    await screen.findByRole('tab', { name: 'Canvas.md' });
    await waitFor(() => expect(markdownEditorFor('Canvas.md').markdown).toBe('# Canvas v1'));

    const canvas = markdownEditorFor('Canvas.md');
    test.setSaveConflict(true);
    test.setSource('Canvas.md', '# Canvas from the Agent', 'c3');
    act(() => canvas.change?.(null, '# Canvas, reviewed', '# Canvas v1'));

    expect(await screen.findByRole('tab', { name: 'Canvas.md, unsaved changes' })).not.toBeNull();
    expect(
      await screen.findByRole('heading', { name: 'Canvas.md changed on disk' }, { timeout: 3_000 }),
    ).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Reload' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Merge' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Overwrite' })).not.toBeNull();
    expect(test.saves).toEqual([]);
  });

  it('suppresses the clipboard import offer while the Agent composer holds focus', async () => {
    const test = harness();
    render(
      <Providers>
        <App dependencies={test.dependencies} />
      </Providers>,
    );
    const composer = await messageEditor();
    const { capture } = test.dependencies;
    if (!capture) throw new Error('The harness always supplies a capture bridge.');
    expect(capture.setComposerFocused).toHaveBeenCalledWith(false);

    act(() => composer.focus());
    await waitFor(() => expect(capture.setComposerFocused).toHaveBeenCalledWith(true));

    act(() => composer.contentDOM.blur());
    await waitFor(() =>
      expect(vi.mocked(capture.setComposerFocused).mock.calls.at(-1)).toEqual([false]),
    );
  });
});
