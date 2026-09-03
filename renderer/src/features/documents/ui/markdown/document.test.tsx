import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { createDocumentNavigationRuntime } from '@/features/documents/application/navigation-runtime';

const editorHarness = vi.hoisted(() => ({
  change: null as ((context: unknown, markdown: string, previous: string) => void) | null,
  instances: [] as Array<{
    action: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
    readonlyValues: boolean[];
    status: string;
  }>,
}));

vi.mock('@milkdown/crepe/builder', () => ({
  CrepeBuilder: class FakeCrepeBuilder {
    readonly instance = {
      action: vi.fn(),
      destroy: vi.fn(async () => undefined),
      readonlyValues: [] as boolean[],
      status: 'OnCreate',
    };

    editor = {
      action: this.instance.action,
      get status() {
        return editorHarness.instances.at(-1)?.status ?? 'OnCreate';
      },
    };

    constructor() {
      editorHarness.instances.push(this.instance);
    }

    addFeature() {
      return this;
    }

    async create() {
      this.instance.status = 'Created';
    }

    destroy = this.instance.destroy;

    getMarkdown() {
      return 'body';
    }

    on(
      register: (listener: {
        markdownUpdated(callback: typeof editorHarness.change): void;
      }) => void,
    ) {
      register({ markdownUpdated: (callback) => (editorHarness.change = callback) });
      return this;
    }

    setReadonly(value: boolean) {
      this.instance.readonlyValues.push(value);
      return this;
    }
  },
}));

import { MarkdownDocument } from './document';

afterEach(() => {
  cleanup();
  editorHarness.change = null;
  editorHarness.instances.length = 0;
});

describe('Markdown document surface', () => {
  it('keeps the document canvas on the raised workspace plane', () => {
    const navigation = createDocumentNavigationRuntime('tab-1');
    render(
      <MarkdownDocument
        active
        canChangeMode
        dirty={false}
        mode="reading"
        name="plan.md"
        onChange={vi.fn()}
        onNavigate={vi.fn()}
        onModeChange={vi.fn()}
        onOpenExternal={vi.fn(async () => true)}
        navigation={navigation}
        readOnly
        source={{ folderPath: '/library/notes', path: 'plan.md' }}
        tabId="tab-1"
        value="# Plan"
      />,
    );

    expect(
      screen
        .getByRole('document', { name: 'plan.md Markdown content' })
        .classList.contains('bg-surface-2'),
    ).toBe(true);
  });

  it('reattaches valid frontmatter when Milkdown serializes a Writer change', async () => {
    const onChange = vi.fn();
    const navigation = createDocumentNavigationRuntime('tab-1');
    render(
      <MarkdownDocument
        active
        canChangeMode
        dirty={false}
        mode="writer"
        name="plan.md"
        onChange={onChange}
        onNavigate={vi.fn()}
        onModeChange={vi.fn()}
        onOpenExternal={vi.fn(async () => true)}
        navigation={navigation}
        readOnly={false}
        source={{ folderPath: '/library/notes', path: 'plan.md' }}
        tabId="tab-1"
        value={'---\ntitle: Plan\n---\nbody'}
      />,
    );
    await waitFor(() =>
      expect(
        screen
          .getByRole('document', { name: 'plan.md Markdown content' })
          .getAttribute('data-markdown-state'),
      ).toBe('ready'),
    );

    act(() => editorHarness.change?.({}, 'updated body', 'body'));

    expect(onChange).toHaveBeenCalledWith('---\ntitle: Plan\n---\nupdated body');
  });

  it('changes the retained editor boundary in place and destroys it on unmount', async () => {
    const navigation = createDocumentNavigationRuntime('tab-1');
    const { rerender, unmount } = render(
      <MarkdownDocument
        active
        canChangeMode
        dirty={false}
        mode="writer"
        name="plan.md"
        onChange={vi.fn()}
        onNavigate={vi.fn()}
        onModeChange={vi.fn()}
        onOpenExternal={vi.fn(async () => true)}
        navigation={navigation}
        readOnly={false}
        source={{ folderPath: '/library/notes', path: 'plan.md' }}
        tabId="tab-1"
        value="body"
      />,
    );
    await waitFor(() => expect(editorHarness.instances).toHaveLength(1));
    const instance = editorHarness.instances[0];

    rerender(
      <MarkdownDocument
        active
        canChangeMode
        dirty={false}
        mode="reading"
        name="plan.md"
        onChange={vi.fn()}
        onNavigate={vi.fn()}
        onModeChange={vi.fn()}
        onOpenExternal={vi.fn(async () => true)}
        navigation={navigation}
        readOnly
        source={{ folderPath: '/library/notes', path: 'plan.md' }}
        tabId="tab-1"
        value="body"
      />,
    );

    expect(editorHarness.instances).toHaveLength(1);
    expect(instance.readonlyValues.at(-1)).toBe(true);
    unmount();
    expect(instance.destroy).toHaveBeenCalledOnce();
  });
});
