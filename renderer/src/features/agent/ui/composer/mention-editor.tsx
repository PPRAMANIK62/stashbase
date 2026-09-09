import {
  defaultKeymap,
  history,
  historyKeymap,
  insertNewline,
  invertedEffects,
} from '@codemirror/commands';
import {
  Compartment,
  EditorState,
  RangeSet,
  RangeValue,
  StateEffect,
  StateField,
} from '@codemirror/state';
import {
  Decoration,
  type DecorationSet,
  EditorView,
  keymap,
  placeholder,
  WidgetType,
} from '@codemirror/view';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

import type { InputMessageEditorContext } from '@/components/ui/input-message';
import type { ContextStatus, MentionQuery } from '@/features/agent/domain/context';
import { fontWeights } from '@/lib/font-weight';

/**
 * The composer's text field: a CodeMirror document in which a mention is one
 * atomic widget. The chip lives where it was typed, moves with the text, and
 * deletes as one character. The serialized draft the session keeps reads
 * `@path` in the chip's place, which is what the wire prompt and history
 * already understand.
 */

const MENTION = '￼';
const STATUS_WORD: Record<ContextStatus, string> = {
  blocked: 'Blocked',
  failed: 'Failed',
  preparing: 'Preparing',
  ready: 'Ready',
  stale: 'Stale',
};

export interface MentionEditorHandle {
  focus(): void;
  /** Turn the open `@` query, or the caret, into a chip for `path`. */
  insertMention(path: string): void;
}

export interface MentionEditorListbox {
  open: boolean;
  controls?: string;
  activeOptionId?: string;
  onNavigate(direction: 1 | -1): void;
  onAccept(): boolean;
  onDismiss(): void;
}

export interface MentionEditorProps {
  ctx: InputMessageEditorContext;
  /** Paths whose `@path` runs in an externally supplied value become chips. */
  chipPaths: readonly string[];
  /** Per-path state shown as a dot in the chip; absent means ready. */
  statuses: Readonly<Record<string, ContextStatus>>;
  listbox: MentionEditorListbox;
  onQueryChange(query: MentionQuery | null): void;
  onMentionAdded(path: string): void;
  /** Fired when the last chip for a path leaves the document. */
  onMentionRemoved(path: string): void;
}

class Mention extends RangeValue {
  // Text typed at the chip's right edge stays outside the marker range;
  // otherwise mapping grows the range and keepMentionMarkers drops it.
  endSide = -1;

  constructor(
    readonly path: string,
    readonly fresh: boolean,
  ) {
    super();
  }

  eq(other: Mention) {
    return this.path === other.path;
  }
}

function basename(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

function reducedMotion(root: Document): boolean {
  const view = root.defaultView;
  return (
    typeof view?.matchMedia === 'function' &&
    view.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

class MentionWidget extends WidgetType {
  constructor(
    private readonly path: string,
    private readonly status: ContextStatus,
    private readonly fresh: boolean,
  ) {
    super();
  }

  eq(other: MentionWidget) {
    return this.path === other.path && this.status === other.status;
  }

  toDOM(view: EditorView) {
    // The widget builds DOM for the editor's own document, never a global.
    const root = view.dom.ownerDocument;
    const chip = root.createElement('span');
    chip.className =
      'mx-px inline-flex max-w-full items-center gap-1 rounded-md bg-foreground/8 px-1.5 align-baseline font-medium whitespace-nowrap text-foreground';
    chip.title = this.path;
    chip.setAttribute('data-mention', this.path);

    const glyph = root.createElementNS('http://www.w3.org/2000/svg', 'svg');
    glyph.setAttribute('width', '12');
    glyph.setAttribute('height', '12');
    glyph.setAttribute('viewBox', '0 0 24 24');
    glyph.setAttribute('fill', 'none');
    glyph.setAttribute('stroke', 'currentColor');
    glyph.setAttribute('stroke-width', '1.5');
    glyph.setAttribute('stroke-linecap', 'round');
    glyph.setAttribute('stroke-linejoin', 'round');
    glyph.setAttribute('aria-hidden', 'true');
    glyph.classList.add('shrink-0', 'text-muted-foreground');
    for (const d of ['M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z', 'M14 3v5h5']) {
      const path = root.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      glyph.append(path);
    }
    chip.append(glyph);

    const name = root.createElement('span');
    name.textContent = basename(this.path);
    chip.append(name);

    if (this.status !== 'ready') {
      const dot = root.createElement('span');
      const alarming = this.status === 'stale' || this.status === 'failed';
      dot.className = `size-1.5 shrink-0 rounded-full ${alarming ? 'bg-destructive' : 'bg-muted-foreground'}`;
      dot.title = STATUS_WORD[this.status];
      dot.setAttribute('aria-hidden', 'true');
      chip.append(dot);
    }

    // The chip has no role, so a label on it would be dropped; the full
    // path travels in the text layer instead.
    const spoken = root.createElement('span');
    spoken.className = 'sr-only';
    spoken.textContent =
      this.status === 'ready'
        ? ` (file mention: ${this.path})`
        : ` (file mention: ${this.path}, ${STATUS_WORD[this.status].toLowerCase()})`;
    chip.append(spoken);

    if (this.fresh && typeof chip.animate === 'function' && !reducedMotion(root)) {
      chip.animate(
        [
          { opacity: 0, transform: 'scale(0.92)' },
          { opacity: 1, transform: 'scale(1)' },
        ],
        { duration: 80, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' },
      );
    }
    return chip;
  }

  ignoreEvent() {
    return false;
  }
}

interface MentionEffect {
  from: number;
  path: string;
  fresh: boolean;
}

const addMention = StateEffect.define<MentionEffect>({
  map: (value, changes) => ({ ...value, from: changes.mapPos(value.from, -1) }),
});

const removeMention = StateEffect.define<MentionEffect>({
  map: (value, changes) => ({ ...value, from: changes.mapPos(value.from, -1) }),
});

const setStatuses = StateEffect.define<Readonly<Record<string, ContextStatus>>>();

function keepMentionMarkers(mentions: RangeSet<Mention>, doc: EditorState['doc']) {
  const kept: ReturnType<Mention['range']>[] = [];
  mentions.between(0, doc.length, (from, to, mention) => {
    if (doc.sliceString(from, to) === MENTION) kept.push(mention.range(from, to));
  });
  return RangeSet.of(kept, true);
}

const mentionField = StateField.define<RangeSet<Mention>>({
  create: () => RangeSet.empty,
  update: (value, transaction) => {
    let mentions = keepMentionMarkers(value.map(transaction.changes), transaction.state.doc);
    for (const effect of transaction.effects) {
      if (effect.is(addMention)) {
        mentions = mentions.update({
          add: [
            new Mention(effect.value.path, effect.value.fresh).range(
              effect.value.from,
              effect.value.from + MENTION.length,
            ),
          ],
          sort: true,
        });
      } else if (effect.is(removeMention)) {
        mentions = mentions.update({
          filter: (from, _to, mention) =>
            from !== effect.value.from || mention.path !== effect.value.path,
        });
      }
    }
    return mentions;
  },
  provide: (field) => EditorView.atomicRanges.of((view) => view.state.field(field)),
});

const statusField = StateField.define<Readonly<Record<string, ContextStatus>>>({
  create: () => ({}),
  update: (value, transaction) => {
    for (const effect of transaction.effects) if (effect.is(setStatuses)) return effect.value;
    return value;
  },
});

const mentionDecorations = EditorView.decorations.compute(
  [mentionField, statusField],
  (state): DecorationSet => {
    const statuses = state.field(statusField);
    const decorations: ReturnType<Decoration['range']>[] = [];
    state.field(mentionField).between(0, state.doc.length, (from, to, mention) => {
      decorations.push(
        Decoration.replace({
          widget: new MentionWidget(mention.path, statuses[mention.path] ?? 'ready', mention.fresh),
        }).range(from, to),
      );
    });
    return Decoration.set(decorations, true);
  },
);

export function serialize(state: EditorState): string {
  let cursor = 0;
  let text = '';
  state.field(mentionField).between(0, state.doc.length, (from, to, mention) => {
    text += state.doc.sliceString(cursor, from) + `@${mention.path}`;
    cursor = to;
  });
  return text + state.doc.sliceString(cursor);
}

function mentionPaths(state: EditorState): Set<string> {
  const paths = new Set<string>();
  state.field(mentionField).between(0, state.doc.length, (_from, _to, mention) => {
    paths.add(mention.path);
  });
  return paths;
}

export function mentionQuery(state: EditorState): MentionQuery | null {
  const selection = state.selection.main;
  if (!selection.empty) return null;
  const before = state.doc.sliceString(0, selection.head);
  const match = /(^|\s)@([^\s@/]*)$/u.exec(before);
  if (!match) return null;
  const query = match[2] ?? '';
  return { from: selection.head - query.length - 1, query };
}

function deleteMentionSelection(view: EditorView, backward: boolean) {
  const selection = view.state.selection.main;
  const mentions = view.state.field(mentionField);
  let from = selection.from;
  let to = selection.to;
  if (selection.empty) {
    const targets: { from: number; to: number }[] = [];
    mentions.between(0, view.state.doc.length, (mentionFrom, mentionTo) => {
      if (
        (backward && mentionTo === selection.head) ||
        (!backward && mentionFrom === selection.head)
      ) {
        targets.push({ from: mentionFrom, to: mentionTo });
      }
    });
    const target = targets[0];
    if (!target) return false;
    from = target.from;
    to = target.to;
  }
  const removed: StateEffect<MentionEffect>[] = [];
  mentions.between(from, to, (mentionFrom, mentionTo, mention) => {
    if (mentionFrom < to && mentionTo > from) {
      removed.push(removeMention.of({ fresh: false, from: mentionFrom, path: mention.path }));
    }
  });
  if (!removed.length) return false;
  view.dispatch({ changes: { from, to }, effects: removed });
  return true;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

/** `@path` runs in plain text, for every known path, left to right. */
export function chipRuns(
  text: string,
  paths: readonly string[],
): Array<{ from: number; path: string; to: number }> {
  const runs: Array<{ from: number; path: string; to: number }> = [];
  for (const path of paths) {
    const pattern = new RegExp(`(^|\\s)@${escapeRegExp(path)}(?=$|\\s)`, 'gu');
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text))) {
      const from = match.index + (match[1]?.length ?? 0);
      runs.push({ from, path, to: from + 1 + path.length });
    }
  }
  runs.sort((a, b) => a.from - b.from || b.to - a.to);
  return runs.filter((run, index) => index === 0 || run.from >= runs[index - 1]!.to);
}

/** Replace the whole document with `text`, chipping the known paths. */
function replaceDocument(view: EditorView, text: string, paths: readonly string[]) {
  const runs = chipRuns(text, paths);
  let result = '';
  let cursor = 0;
  const effects: StateEffect<MentionEffect>[] = [];
  for (const run of runs) {
    result += text.slice(cursor, run.from);
    effects.push(addMention.of({ fresh: false, from: result.length, path: run.path }));
    result += MENTION;
    cursor = run.to;
  }
  result += text.slice(cursor);
  view.dispatch({
    changes: { from: 0, insert: result, to: view.state.doc.length },
    effects,
    selection: { anchor: result.length },
  });
}

/** Chip `@path` runs still sitting as plain text in the live document. */
function chipInPlace(view: EditorView, paths: readonly string[]) {
  const runs = chipRuns(view.state.doc.toString(), paths);
  if (runs.length === 0) return;
  // Right to left, so earlier offsets survive each replacement; effect
  // positions are in the post-change document.
  const changes = runs.map((run) => ({ from: run.from, insert: MENTION, to: run.to }));
  const changeSet = view.state.changes(changes);
  view.dispatch({
    changes: changeSet,
    effects: runs.map((run) =>
      addMention.of({ fresh: false, from: changeSet.mapPos(run.from, -1), path: run.path }),
    ),
  });
}

export const MentionEditor = forwardRef<MentionEditorHandle, MentionEditorProps>(
  function MentionEditor(
    { chipPaths, ctx, listbox, onMentionAdded, onMentionRemoved, onQueryChange, statuses },
    ref,
  ) {
    const hostRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const ctxRef = useRef(ctx);
    const listboxRef = useRef(listbox);
    const onQueryChangeRef = useRef(onQueryChange);
    const onMentionAddedRef = useRef(onMentionAdded);
    const onMentionRemovedRef = useRef(onMentionRemoved);
    const dismissedRef = useRef(false);
    const editable = useRef(new Compartment());
    const placeholderCompartment = useRef(new Compartment());
    const attributes = useRef(new Compartment());
    const theme = useRef(new Compartment());
    ctxRef.current = ctx;
    listboxRef.current = listbox;
    onQueryChangeRef.current = onQueryChange;
    onMentionAddedRef.current = onMentionAdded;
    onMentionRemovedRef.current = onMentionRemoved;

    useImperativeHandle(ref, () => ({
      focus: () => viewRef.current?.focus(),
      insertMention: (path) => {
        const view = viewRef.current;
        if (!view) return;
        const query = mentionQuery(view.state);
        const head = view.state.selection.main.head;
        const from = query ? query.from : head;
        const before = view.state.doc.sliceString(Math.max(0, from - 1), from);
        const lead = query || from === 0 || /\s/u.test(before) ? '' : ' ';
        const insert = `${lead}${MENTION} `;
        view.dispatch({
          changes: { from, insert, to: head },
          effects: addMention.of({ fresh: true, from: from + lead.length, path }),
          selection: { anchor: from + insert.length },
        });
        view.focus();
        onMentionAddedRef.current(path);
      },
    }));

    useEffect(() => {
      const host = hostRef.current;
      if (!host) return;
      const runListboxKey = (key: string) => {
        const box = listboxRef.current;
        if (!box.open) return false;
        if (key === 'ArrowDown') {
          box.onNavigate(1);
          return true;
        }
        if (key === 'ArrowUp') {
          box.onNavigate(-1);
          return true;
        }
        if (key === 'Enter' || key === 'Tab') return box.onAccept();
        if (key === 'Escape') {
          dismissedRef.current = true;
          box.onDismiss();
          onQueryChangeRef.current(null);
          return true;
        }
        return false;
      };
      const view = new EditorView({
        parent: host,
        state: EditorState.create({
          extensions: [
            history(),
            invertedEffects.of((transaction) =>
              transaction.effects.flatMap((effect) => {
                if (effect.is(addMention)) return [removeMention.of(effect.value)];
                if (effect.is(removeMention)) return [addMention.of(effect.value)];
                return [];
              }),
            ),
            mentionField,
            statusField,
            mentionDecorations,
            EditorView.lineWrapping,
            EditorView.domEventHandlers({
              blur: () => {
                ctxRef.current.onFocusChange(false);
                return false;
              },
              focus: (_event, focused) => {
                let visible = true;
                try {
                  visible = focused.contentDOM.matches(':focus-visible');
                } catch {
                  visible = true;
                }
                ctxRef.current.onFocusChange(visible);
                return false;
              },
            }),
            placeholderCompartment.current.of(placeholder(ctxRef.current.placeholder)),
            editable.current.of(EditorView.editable.of(!ctxRef.current.disabled)),
            attributes.current.of(EditorView.contentAttributes.of({})),
            theme.current.of([]),
            keymap.of([
              { key: 'ArrowDown', run: () => runListboxKey('ArrowDown') },
              { key: 'ArrowUp', run: () => runListboxKey('ArrowUp') },
              {
                key: 'Enter',
                run: () => {
                  if (runListboxKey('Enter')) return true;
                  if (!ctxRef.current.disabled) ctxRef.current.submit();
                  return true;
                },
              },
              { key: 'Shift-Enter', run: insertNewline },
              { key: 'Tab', run: () => runListboxKey('Tab') },
              { key: 'Escape', run: () => runListboxKey('Escape') },
              { key: 'Backspace', run: (target) => deleteMentionSelection(target, true) },
              { key: 'Delete', run: (target) => deleteMentionSelection(target, false) },
              ...defaultKeymap,
              ...historyKeymap,
            ]),
            EditorView.updateListener.of((update) => {
              if (update.docChanged) {
                dismissedRef.current = false;
                ctxRef.current.onValueChange(serialize(update.state));
                const before = mentionPaths(update.startState);
                const after = mentionPaths(update.state);
                for (const path of before) {
                  if (!after.has(path)) onMentionRemovedRef.current(path);
                }
              }
              if (update.docChanged || update.selectionSet) {
                onQueryChangeRef.current(dismissedRef.current ? null : mentionQuery(update.state));
              }
            }),
          ],
        }),
      });
      viewRef.current = view;
      if (ctxRef.current.value) replaceDocument(view, ctxRef.current.value, chipPaths);
      return () => {
        ctxRef.current.onFocusChange(false);
        view.destroy();
        viewRef.current = null;
      };
      // The editor owns its document; callbacks and props are read through refs.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
      viewRef.current?.dispatch({
        effects: editable.current.reconfigure(EditorView.editable.of(!ctx.disabled)),
      });
    }, [ctx.disabled]);

    useEffect(() => {
      viewRef.current?.dispatch({
        effects: placeholderCompartment.current.reconfigure(placeholder(ctx.placeholder)),
      });
    }, [ctx.placeholder]);

    const { fontSize, lineHeight, paddingX, paddingY } = ctx.metrics;
    useEffect(() => {
      viewRef.current?.dispatch({
        effects: theme.current.reconfigure(
          EditorView.theme({
            '&': {
              font: 'inherit',
              fontSize: `${fontSize}px`,
              lineHeight: `${lineHeight}px`,
              minHeight: `${lineHeight * ctx.minRows + paddingY * 2}px`,
            },
            '&.cm-focused': { outline: 'none' },
            '.cm-content': {
              caretColor: 'var(--foreground)',
              padding: `${paddingY}px ${paddingX}px`,
            },
            '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--foreground)' },
            '.cm-line': { padding: '0' },
            '.cm-placeholder': { color: 'var(--muted-foreground)' },
            '.cm-scroller': {
              fontFamily: 'inherit',
              lineHeight: 'inherit',
              maxHeight: `${lineHeight * ctx.maxRows + paddingY * 2}px`,
              overflow: 'auto',
            },
            '.cm-selectionBackground, ::selection': {
              backgroundColor: 'var(--selected) !important',
            },
          }),
        ),
      });
    }, [ctx.maxRows, ctx.minRows, fontSize, lineHeight, paddingX, paddingY]);

    useEffect(() => {
      viewRef.current?.dispatch({
        effects: attributes.current.reconfigure(
          EditorView.contentAttributes.of({
            'aria-activedescendant': listbox.open ? (listbox.activeOptionId ?? '') : '',
            'aria-autocomplete': 'list',
            'aria-controls': listbox.open ? (listbox.controls ?? '') : '',
            'aria-describedby': ctx.ariaDescribedBy ?? '',
            'aria-expanded': listbox.open ? 'true' : 'false',
            'aria-label': ctx.ariaLabel,
            'aria-multiline': 'true',
            role: 'textbox',
          }),
        ),
      });
    }, [
      ctx.ariaDescribedBy,
      ctx.ariaLabel,
      listbox.activeOptionId,
      listbox.controls,
      listbox.open,
    ]);

    useEffect(() => {
      viewRef.current?.dispatch({ effects: setStatuses.of(statuses) });
    }, [statuses]);

    // External value sync: a cleared draft after send, a queued message
    // pulled back for editing, a starter prefill, or a tile removed from the
    // preview row all arrive as a new value; known paths become chips again.
    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      if (serialize(view.state) !== ctx.value) replaceDocument(view, ctx.value, chipPaths);
      else chipInPlace(view, chipPaths);
    }, [chipPaths, ctx.value]);

    return (
      <div
        className="text-foreground"
        ref={hostRef}
        style={{ fontVariationSettings: fontWeights.normal }}
      />
    );
  },
);
