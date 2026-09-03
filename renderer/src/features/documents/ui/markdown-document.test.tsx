import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

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

import { MarkdownDocument } from './markdown-document';

afterEach(() => {
  cleanup();
  editorHarness.change = null;
  editorHarness.instances.length = 0;
});

describe('Markdown document surface', () => {
  it('reattaches valid frontmatter when Milkdown serializes a Writer change', async () => {
    const onChange = vi.fn();
    render(
      <MarkdownDocument
        canChangeMode
        dirty={false}
        mode="writer"
        name="plan.md"
        onChange={onChange}
        onModeChange={vi.fn()}
        readOnly={false}
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
    const { rerender, unmount } = render(
      <MarkdownDocument
        canChangeMode
        dirty={false}
        mode="writer"
        name="plan.md"
        onChange={vi.fn()}
        onModeChange={vi.fn()}
        readOnly={false}
        value="body"
      />,
    );
    await waitFor(() => expect(editorHarness.instances).toHaveLength(1));
    const instance = editorHarness.instances[0];

    rerender(
      <MarkdownDocument
        canChangeMode
        dirty={false}
        mode="reading"
        name="plan.md"
        onChange={vi.fn()}
        onModeChange={vi.fn()}
        readOnly
        value="body"
      />,
    );

    expect(editorHarness.instances).toHaveLength(1);
    expect(instance.readonlyValues.at(-1)).toBe(true);
    unmount();
    expect(instance.destroy).toHaveBeenCalledOnce();
  });
});
