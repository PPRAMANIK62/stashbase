import { EditorView } from '@codemirror/view';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import type { InputMessageEditorContext } from '@/components/ui/input-message';

import { chipRuns, MentionEditor, serialize, type MentionEditorHandle } from './mention-editor';

afterEach(cleanup);

const metrics = { fontSize: 14, lineHeight: 20, paddingX: 8, paddingY: 8 };

function harness(value = '', chipPaths: string[] = []) {
  const onValueChange = vi.fn();
  const onMentionAdded = vi.fn();
  const onMentionRemoved = vi.fn();
  const onQueryChange = vi.fn();
  const submit = vi.fn();
  const ctx: InputMessageEditorContext = {
    ariaLabel: 'Message',
    disabled: false,
    maxRows: 6,
    metrics,
    minRows: 3,
    onFocusChange: vi.fn(),
    onValueChange,
    placeholder: 'Ask',
    submit,
    value,
  };
  const ref: { current: MentionEditorHandle | null } = { current: null };
  const listbox = {
    onAccept: vi.fn(() => true),
    onDismiss: vi.fn(),
    onNavigate: vi.fn(),
    open: false,
  };
  const view = render(
    <MentionEditor
      chipPaths={chipPaths}
      ctx={ctx}
      listbox={listbox}
      onMentionAdded={onMentionAdded}
      onMentionRemoved={onMentionRemoved}
      onQueryChange={onQueryChange}
      ref={ref}
      statuses={{}}
    />,
  );
  const field = view.container.querySelector<HTMLElement>('[contenteditable="true"]')!;
  const editor = EditorView.findFromDOM(view.container.querySelector('.cm-editor') as HTMLElement)!;
  return {
    editor,
    field,
    listbox,
    onMentionAdded,
    onMentionRemoved,
    onQueryChange,
    onValueChange,
    ref,
    submit,
    view,
  };
}

describe('mention editor', () => {
  it('finds @path runs in plain text at word boundaries only', () => {
    expect(chipRuns('See @docs/a.md and @docs/a.md.bak, x@docs/a.md', ['docs/a.md'])).toEqual([
      { from: 4, path: 'docs/a.md', to: 14 },
    ]);
  });

  it('inserts a chip that serializes back to @path and binds it', () => {
    const { editor, field, onMentionAdded, onValueChange, ref } = harness();
    act(() => {
      editor.dispatch({ changes: { from: 0, insert: 'Read @no' }, selection: { anchor: 8 } });
    });
    act(() => ref.current?.insertMention('notes.md'));
    expect(serialize(editor.state)).toBe('Read @notes.md ');
    expect(onValueChange).toHaveBeenLastCalledWith('Read @notes.md ');
    expect(onMentionAdded).toHaveBeenCalledWith('notes.md');
    const chip = field.querySelector('[data-mention="notes.md"]');
    expect(chip?.textContent).toBe('notes.md (file mention: notes.md)');
    expect(editor.state.doc.toString()).toBe('Read ￼ ');
  });

  it('re-chips known paths in an externally supplied value and reports removals', () => {
    const { editor, field, onMentionRemoved, view } = harness();
    view.rerender(
      <MentionEditor
        chipPaths={['docs/a.md', 'b.pdf']}
        ctx={{
          ariaLabel: 'Message',
          disabled: false,
          maxRows: 6,
          metrics,
          minRows: 3,
          onFocusChange: vi.fn(),
          onValueChange: vi.fn(),
          placeholder: 'Ask',
          submit: vi.fn(),
          value: 'Compare @docs/a.md with @b.pdf now',
        }}
        listbox={{
          onAccept: vi.fn(() => true),
          onDismiss: vi.fn(),
          onNavigate: vi.fn(),
          open: false,
        }}
        onMentionAdded={vi.fn()}
        onMentionRemoved={onMentionRemoved}
        onQueryChange={vi.fn()}
        statuses={{ 'b.pdf': 'preparing' }}
      />,
    );
    expect(serialize(editor.state)).toBe('Compare @docs/a.md with @b.pdf now');
    expect(field.querySelectorAll('[data-mention]')).toHaveLength(2);
    expect(field.querySelector('[data-mention="b.pdf"] .bg-muted-foreground')).not.toBeNull();
    expect(field.querySelector('[data-mention="b.pdf"]')?.textContent).toContain('preparing');

    // Backspace with the caret right after the second chip deletes it whole.
    const doc = editor.state.doc.toString();
    const at = doc.indexOf('￼', doc.indexOf('￼') + 1) + 1;
    act(() => editor.dispatch({ selection: { anchor: at } }));
    act(() => {
      fireEvent.keyDown(field, { key: 'Backspace' });
    });
    expect(serialize(editor.state)).toBe('Compare @docs/a.md with  now');
    expect(onMentionRemoved).toHaveBeenCalledWith('b.pdf');
  });

  it('routes Enter to the listbox while open and to submit otherwise', () => {
    const { field, listbox, submit, view } = harness();
    act(() => {
      fireEvent.keyDown(field, { key: 'Enter' });
    });
    expect(submit).toHaveBeenCalledTimes(1);
    listbox.open = true;
    view.rerender(
      <MentionEditor
        chipPaths={[]}
        ctx={{
          ariaLabel: 'Message',
          disabled: false,
          maxRows: 6,
          metrics,
          minRows: 3,
          onFocusChange: vi.fn(),
          onValueChange: vi.fn(),
          placeholder: 'Ask',
          submit,
          value: '',
        }}
        listbox={{ ...listbox, controls: 'box', open: true }}
        onMentionAdded={vi.fn()}
        onMentionRemoved={vi.fn()}
        onQueryChange={vi.fn()}
        statuses={{}}
      />,
    );
    act(() => {
      fireEvent.keyDown(field, { key: 'Enter' });
    });
    expect(listbox.onAccept).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(field.getAttribute('aria-expanded')).toBe('true');
    expect(field.getAttribute('aria-controls')).toBe('box');
  });
});
