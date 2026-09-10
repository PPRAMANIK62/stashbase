import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import {
  chipInPlace,
  chipRuns,
  deleteMentionSelection,
  projectSkill,
  replaceDocument,
} from './mention-document';
import { MENTION, mentionField, mentionPaths, serialize, skillMarker } from './mention-markers';

const views: EditorView[] = [];

function createView(doc = ''): EditorView {
  const parent = document.createElement('div');
  document.body.append(parent);
  const view = new EditorView({
    parent,
    state: EditorState.create({ doc, extensions: [mentionField] }),
  });
  views.push(view);
  return view;
}

/** Offsets of every marker in the live document, left to right. */
function markerRanges(view: EditorView): Array<{ from: number; path: string; to: number }> {
  const ranges: Array<{ from: number; path: string; to: number }> = [];
  view.state
    .field(mentionField)
    .between(
      0,
      view.state.doc.length,
      (from, to, mention) => void ranges.push({ from, path: mention.path, to }),
    );
  return ranges;
}

afterEach(() => {
  for (const view of views.splice(0)) {
    view.dom.parentElement?.remove();
    view.destroy();
  }
});

describe('chip runs', () => {
  it('takes @path only at word boundaries and never as a prefix of a longer name', () => {
    expect(chipRuns('See @docs/a.md and @docs/a.md.bak, x@docs/a.md', ['docs/a.md'])).toEqual([
      { from: 4, path: 'docs/a.md', to: 14 },
    ]);
  });

  it('reads a path as literal text rather than as a pattern', () => {
    expect(chipRuns('open @a+b(1).md now', ['a+b(1).md'])).toEqual([
      { from: 5, path: 'a+b(1).md', to: 15 },
    ]);
    expect(chipRuns('open @aXb(1).md now', ['a+b(1).md'])).toEqual([]);
  });

  it('orders runs left to right and keeps the longest of two overlapping paths', () => {
    expect(chipRuns('@b.md then @docs/a.md', ['docs/a.md', 'b.md'])).toEqual([
      { from: 0, path: 'b.md', to: 5 },
      { from: 11, path: 'docs/a.md', to: 21 },
    ]);
    expect(chipRuns('@docs/a.md', ['docs', 'docs/a.md'])).toEqual([
      { from: 0, path: 'docs/a.md', to: 10 },
    ]);
  });

  it('finds every occurrence of the same path', () => {
    expect(chipRuns('@a.md and @a.md', ['a.md']).map((run) => run.from)).toEqual([0, 10]);
  });
});

describe('replace document', () => {
  it('chips known paths in a value that arrived from outside', () => {
    const view = createView('stale');
    replaceDocument(view, 'Compare @docs/a.md with @b.md now', ['docs/a.md', 'b.md'], null);

    expect(serialize(view.state)).toBe('Compare @docs/a.md with @b.md now');
    expect(view.state.doc.toString()).toBe(`Compare ${MENTION} with ${MENTION} now`);
    expect([...mentionPaths(view.state)]).toEqual(['docs/a.md', 'b.md']);
    expect(view.state.selection.main.head).toBe(view.state.doc.length);
  });

  it('re-adds the armed skill as the leading token the draft does not carry', () => {
    const view = createView();
    replaceDocument(view, 'Check @a.md', ['a.md'], { label: 'review' });

    expect(view.state.doc.toString()).toBe(`${MENTION} Check ${MENTION}`);
    expect(serialize(view.state)).toBe('Check @a.md');
    expect(skillMarker(view.state)).toEqual({ from: 0, path: 'review', to: 1 });
  });

  it('leaves text alone when no known path appears in it', () => {
    const view = createView();
    replaceDocument(view, 'nothing to chip', ['a.md'], null);

    expect(view.state.doc.toString()).toBe('nothing to chip');
    expect(mentionPaths(view.state).size).toBe(0);
  });
});

describe('project skill', () => {
  it('inserts the token ahead of the draft and keeps the caret on the same text', () => {
    const view = createView('outline it');
    view.dispatch({ selection: { anchor: 7 } });
    projectSkill(view, { label: 'review' });

    expect(view.state.doc.toString()).toBe(`${MENTION} outline it`);
    expect(view.state.selection.main.head).toBe(9);
    expect(skillMarker(view.state)?.path).toBe('review');
  });

  it('does nothing when the document already shows that skill', () => {
    const view = createView('draft');
    projectSkill(view, { label: 'review' });
    const before = view.state.doc.toString();
    projectSkill(view, { label: 'review' });

    expect(view.state.doc.toString()).toBe(before);
    expect(markerRanges(view)).toHaveLength(1);
  });

  it('relabels the token to the newly armed skill', () => {
    const view = createView('draft');
    projectSkill(view, { label: 'review' });
    projectSkill(view, { label: 'summarize' });

    expect(markerRanges(view)).toEqual([{ from: 0, path: 'summarize', to: 1 }]);
    expect(serialize(view.state)).toBe('draft');
  });

  it('removes the token and the space that seated it when the skill is disarmed', () => {
    const view = createView('draft');
    projectSkill(view, { label: 'review' });
    projectSkill(view, null);

    expect(view.state.doc.toString()).toBe('draft');
    expect(skillMarker(view.state)).toBeNull();
  });

  it('stays out of a document that never carried a token', () => {
    const view = createView('draft');
    projectSkill(view, null);

    expect(view.state.doc.toString()).toBe('draft');
  });
});

describe('chip in place', () => {
  it('replaces plain @path runs already sitting in the live document', () => {
    const view = createView('see @notes.md here');
    chipInPlace(view, ['notes.md']);

    expect(view.state.doc.toString()).toBe(`see ${MENTION} here`);
    expect(serialize(view.state)).toBe('see @notes.md here');
    expect(markerRanges(view)).toEqual([{ from: 4, path: 'notes.md', to: 5 }]);
  });

  it('keeps every marker on its own path when several runs collapse at once', () => {
    const view = createView('a @x.md b @docs/y.md c');
    chipInPlace(view, ['x.md', 'docs/y.md']);

    expect(view.state.doc.toString()).toBe(`a ${MENTION} b ${MENTION} c`);
    expect(markerRanges(view)).toEqual([
      { from: 2, path: 'x.md', to: 3 },
      { from: 6, path: 'docs/y.md', to: 7 },
    ]);
  });

  it('touches nothing when the document holds no known run', () => {
    const view = createView('see @other.md here');
    chipInPlace(view, ['notes.md']);

    expect(view.state.doc.toString()).toBe('see @other.md here');
    expect(mentionPaths(view.state).size).toBe(0);
  });
});

describe('delete mention selection', () => {
  function chipped(text = 'see @notes.md here'): EditorView {
    const view = createView(text);
    chipInPlace(view, ['notes.md']);
    return view;
  }

  it('takes the whole chip when Backspace lands on its right edge', () => {
    const view = chipped();
    view.dispatch({ selection: { anchor: 5 } });

    expect(deleteMentionSelection(view, true)).toBe(true);
    expect(serialize(view.state)).toBe('see  here');
    expect(mentionPaths(view.state).size).toBe(0);
  });

  it('takes the whole chip when Delete lands on its left edge', () => {
    const view = chipped();
    view.dispatch({ selection: { anchor: 4 } });

    expect(deleteMentionSelection(view, false)).toBe(true);
    expect(serialize(view.state)).toBe('see  here');
  });

  it('refuses a caret that is not against a chip and leaves the text intact', () => {
    const view = chipped();
    view.dispatch({ selection: { anchor: 8 } });

    expect(deleteMentionSelection(view, true)).toBe(false);
    expect(deleteMentionSelection(view, false)).toBe(false);
    expect(serialize(view.state)).toBe('see @notes.md here');
  });

  it('drops every chip a selected range covers', () => {
    const view = createView('@a.md and @b.md tail');
    chipInPlace(view, ['a.md', 'b.md']);
    view.dispatch({ selection: { anchor: 0, head: view.state.doc.length - 5 } });

    expect(deleteMentionSelection(view, true)).toBe(true);
    expect(serialize(view.state)).toBe(' tail');
    expect(mentionPaths(view.state).size).toBe(0);
  });

  it('takes the skill token with its seating space so the draft keeps its first word', () => {
    const view = createView('outline it');
    projectSkill(view, { label: 'review' });
    view.dispatch({ selection: { anchor: 1 } });

    expect(deleteMentionSelection(view, true)).toBe(true);
    expect(view.state.doc.toString()).toBe('outline it');
    expect(skillMarker(view.state)).toBeNull();
  });
});
