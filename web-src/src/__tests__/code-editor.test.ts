import assert from 'node:assert/strict';
import test from 'node:test';
import { EditorState } from '@codemirror/state';
import { history, undo } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { search } from '@codemirror/search';
import type { EditorView } from '@codemirror/view';
import { applyEditorQuery } from '../components/CodeEditor.tsx';
import { renderMarkdown } from '../markdown.ts';
import {
  describeLiveMarkdownProjection,
  hiddenMarkdownMarkupRanges,
  isLiveMarkdownComposition,
  liveMarkdownCompositionGuard,
  setLiveMarkdownComposition,
  shouldRefreshLiveMarkdownProjection,
  toggleMarkdownEmphasis,
  toggleMarkdownStrong,
} from '../components/liveMarkdown.ts';

test('restoring an open find query preserves a saved editor selection', () => {
  let state = EditorState.create({
    doc: 'needle alpha needle',
    extensions: [search()],
  });
  state = state.update({ selection: { anchor: 12 } }).state;
  const view = {
    get state() { return state; },
    dispatch(spec: Parameters<EditorState['update']>[0]) {
      state = state.update(spec).state;
    },
  } as unknown as EditorView;

  const result = applyEditorQuery(view, 'needle', false, false, false);

  assert.equal(state.selection.main.anchor, 12);
  assert.deepEqual(result, { current: 0, total: 2 });
});

function markdownState(doc: string, selection?: { anchor: number; head?: number }) {
  return EditorState.create({
    doc,
    selection,
    extensions: [markdown({ base: markdownLanguage }), history()],
  });
}

function testView(state: EditorState) {
  let current = state;
  return {
    get state() { return current; },
    dispatch(spec: Parameters<EditorState['update']>[0]) {
      current = current.update(spec).state;
    },
  } as unknown as EditorView;
}

test('Live Editing and Reading View share the supported Markdown construct subset', () => {
  const doc = [
    '# ATX heading',
    '',
    '## Second-level ATX heading',
    '',
    '### Third-level ATX heading',
    '',
    '#### Fourth-level ATX heading',
    '',
    '##### Fifth-level ATX heading',
    '',
    '###### Sixth-level ATX heading',
    '',
    'Setext level one heading',
    '===',
    '',
    'Setext level two heading',
    '---',
    '',
    '*emphasis* **strong** ~~strikethrough~~ `inline code`',
    '',
    '---',
  ].join('\n');

  const projectedKinds = new Set(
    describeLiveMarkdownProjection(markdownState(doc, { anchor: doc.length }))
      .map((construct) => construct.kind),
  );
  assert.deepEqual(projectedKinds, new Set([
    'heading',
    'emphasis',
    'strong',
    'strikethrough',
    'inline-code',
    'horizontal-rule',
  ]));
  assert.equal(
    describeLiveMarkdownProjection(markdownState(doc, { anchor: doc.length }))
      .filter((construct) => construct.kind === 'heading').length,
    8,
  );

  const readingView = renderMarkdown(doc);
  assert.match(readingView, /<h1 id="atx-heading">ATX heading<\/h1>/);
  assert.match(readingView, /<h2 id="second-level-atx-heading">Second-level ATX heading<\/h2>/);
  assert.match(readingView, /<h3 id="third-level-atx-heading">Third-level ATX heading<\/h3>/);
  assert.match(readingView, /<h4 id="fourth-level-atx-heading">Fourth-level ATX heading<\/h4>/);
  assert.match(readingView, /<h5 id="fifth-level-atx-heading">Fifth-level ATX heading<\/h5>/);
  assert.match(readingView, /<h6 id="sixth-level-atx-heading">Sixth-level ATX heading<\/h6>/);
  assert.match(readingView, /<h1 id="setext-level-one-heading">Setext level one heading<\/h1>/);
  assert.match(readingView, /<h2 id="setext-level-two-heading">Setext level two heading<\/h2>/);
  assert.match(readingView, /<em>emphasis<\/em>/);
  assert.match(readingView, /<strong>strong<\/strong>/);
  assert.match(readingView, /<del>strikethrough<\/del>/);
  assert.match(readingView, /<code>inline code<\/code>/);
  assert.match(readingView, /<hr\s*\/?>/);
});

test('inactive Markdown constructs hide only recognized syntax and reveal every intersected construct', () => {
  const doc = '# Heading *em* **strong** ~~strike~~ `code`\n\n---\n\n**open';
  const inactive = describeLiveMarkdownProjection(markdownState(doc, { anchor: doc.length }));

  assert.deepEqual(
    inactive.map(({ kind, from, to, active }) => ({ kind, from, to, active })),
    [
      { kind: 'heading', from: 0, to: 43, active: false },
      { kind: 'emphasis', from: 10, to: 14, active: false },
      { kind: 'strong', from: 15, to: 25, active: false },
      { kind: 'strikethrough', from: 26, to: 36, active: false },
      { kind: 'inline-code', from: 37, to: 43, active: false },
      { kind: 'horizontal-rule', from: 45, to: 48, active: false },
    ],
  );

  const selected = describeLiveMarkdownProjection(markdownState(doc, { anchor: 12, head: 48 }));
  assert.ok(selected.every(({ active }) => active));
  assert.equal(markdownState(doc, { anchor: doc.length }).doc.toString(), doc);

  const atx = '# Heading\n\nbody';
  assert.deepEqual(hiddenMarkdownMarkupRanges(markdownState(atx, { anchor: atx.length })), [{ from: 0, to: 2 }]);
  const closingAtx = '# Heading #\n\nbody';
  assert.deepEqual(hiddenMarkdownMarkupRanges(markdownState(closingAtx, { anchor: closingAtx.length })), [
    { from: 0, to: 2 },
    { from: 9, to: 11 },
  ]);

  const setext = 'Setext heading\n===\n\nLower\n---';
  assert.deepEqual(
    describeLiveMarkdownProjection(markdownState(setext, { anchor: 19 })),
    [
      { kind: 'heading', from: 0, to: 18, active: false },
      { kind: 'heading', from: 20, to: 29, active: false },
    ],
  );
  assert.deepEqual(hiddenMarkdownMarkupRanges(markdownState(setext, { anchor: 19 })), [
    { from: 14, to: 18 },
    { from: 25, to: 29 },
  ]);
});

test('Live projection limits work to visible parsed ranges and falls back to source while composing', () => {
  const lines = Array.from({ length: 400 }, (_, index) => `# Heading ${index}\n\nparagraph ${index}`);
  const doc = lines.join('\n\n');
  const target = doc.indexOf('# Heading 0');
  const state = markdownState(doc, { anchor: target + 3 });

  const visible = describeLiveMarkdownProjection(state, {
    ranges: [{ from: target, to: target + 24 }],
  });
  assert.deepEqual(visible.map(({ kind, from }) => ({ kind, from })), [{ kind: 'heading', from: target }]);

  const composing = describeLiveMarkdownProjection(state, {
    ranges: [{ from: target, to: target + 24 }],
    sourceFallbackRanges: [{ from: target, to: target + 12 }],
  });
  assert.deepEqual(composing, []);

  assert.deepEqual(describeLiveMarkdownProjection(state, { ranges: [] }), []);
});

test('Live projection starts and ends source fallback through composition lifecycle effects', () => {
  let state = EditorState.create({ extensions: [liveMarkdownCompositionGuard] });
  const view = { get state() { return state; }, compositionStarted: false } as Pick<EditorView, 'state' | 'compositionStarted'>;
  assert.equal(isLiveMarkdownComposition(view), false);

  state = state.update({ effects: setLiveMarkdownComposition.of(true) }).state;
  assert.equal(isLiveMarkdownComposition(view), true);

  state = state.update({ effects: setLiveMarkdownComposition.of(false) }).state;
  assert.equal(isLiveMarkdownComposition(view), false);
});

test('Live projection refreshes after a background parse-tree update', () => {
  assert.equal(shouldRefreshLiveMarkdownProjection({
    docChanged: false,
    selectionSet: false,
    viewportChanged: false,
    treeChanged: true,
  }), true);
});

test('Live projection keeps RTL source offsets and cross-direction selections authoritative', () => {
  const doc = 'قبل **مهم** אחרי';
  const start = doc.indexOf('**');
  const state = markdownState(doc, { anchor: start + 3, head: start + 7 });
  const projection = describeLiveMarkdownProjection(state);
  assert.deepEqual(projection, [{ kind: 'strong', from: start, to: start + 7, active: true }]);
  assert.equal(state.doc.toString(), doc);
});

test('Markdown strong and emphasis commands wrap, toggle, insert pairs, and undo as one edit', () => {
  const strongView = testView(markdownState('alpha', { anchor: 0, head: 5 }));
  assert.equal(toggleMarkdownStrong(strongView), true);
  assert.equal(strongView.state.doc.toString(), '**alpha**');
  assert.equal(strongView.state.selection.main.from, 2);
  assert.equal(strongView.state.selection.main.to, 7);
  assert.equal(undo(strongView), true);
  assert.equal(strongView.state.doc.toString(), 'alpha');

  const toggleView = testView(markdownState('**alpha**', { anchor: 3, head: 6 }));
  assert.equal(toggleMarkdownStrong(toggleView), true);
  assert.equal(toggleView.state.doc.toString(), 'alpha');
  assert.equal(toggleView.state.selection.main.from, 1);
  assert.equal(toggleView.state.selection.main.to, 4);

  const underscoreView = testView(markdownState('__alpha__', { anchor: 3, head: 6 }));
  assert.equal(toggleMarkdownStrong(underscoreView), true);
  assert.equal(underscoreView.state.doc.toString(), 'alpha');

  const underscoreEmphasisView = testView(markdownState('_alpha_', { anchor: 2, head: 5 }));
  assert.equal(toggleMarkdownEmphasis(underscoreEmphasisView), true);
  assert.equal(underscoreEmphasisView.state.doc.toString(), 'alpha');

  const insertView = testView(markdownState('', { anchor: 0 }));
  assert.equal(toggleMarkdownEmphasis(insertView), true);
  assert.equal(insertView.state.doc.toString(), '**');
  assert.equal(insertView.state.selection.main.anchor, 1);
});
