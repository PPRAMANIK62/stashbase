import { useEffect, useImperativeHandle, useRef } from 'react';
import { Compartment, EditorState, RangeSet, RangeValue, StateEffect, StateField } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, invertedEffects } from '@codemirror/commands';
import { Decoration, type DecorationSet, EditorView, keymap, placeholder, WidgetType } from '@codemirror/view';

const MENTION = '\uFFFC';

export type MentionQuery = { q: string; from: number } | null;

export type MentionComposerHandle = {
  focus: () => void;
  insertMention: (path: string, query: Exclude<MentionQuery, null>) => void;
  submit: () => void;
};

class Mention extends RangeValue {
  // Keep text inserted at the token's right boundary outside the marker range.
  // Otherwise RangeSet mapping expands the range and keepMentionMarkers removes it.
  endSide = -1;

  constructor(readonly path: string) { super(); }

  eq(other: Mention) {
    return this.path === other.path;
  }
}

class MentionWidget extends WidgetType {
  constructor(private readonly path: string) { super(); }

  eq(other: MentionWidget) {
    return this.path === other.path;
  }

  toDOM() {
    const token = document.createElement('span');
    token.className = 'agent-file-mention';
    token.textContent = this.path.split('/').pop() ?? this.path;
    token.title = this.path;
    token.setAttribute('aria-label', `File mention: ${this.path}`);
    return token;
  }
}

type MentionState = { mentions: RangeSet<Mention>; decorations: DecorationSet };

const addMention = StateEffect.define<{ from: number; path: string }>({
  map: (value, changes) => ({ ...value, from: changes.mapPos(value.from, -1) }),
});

const removeMention = StateEffect.define<{ from: number; path: string }>({
  map: (value, changes) => ({ ...value, from: changes.mapPos(value.from, -1) }),
});

const mentionField = StateField.define<MentionState>({
  create: () => buildMentionState(RangeSet.empty),
  update: (value, transaction) => {
    let mentions = keepMentionMarkers(value.mentions.map(transaction.changes), transaction.state.doc);
    for (const effect of transaction.effects) {
      if (effect.is(addMention)) {
        mentions = mentions.update({
          add: [new Mention(effect.value.path).range(effect.value.from, effect.value.from + MENTION.length)],
          sort: true,
        });
      } else if (effect.is(removeMention)) {
        mentions = mentions.update({
          filter: (from, _to, mention) => from !== effect.value.from || mention.path !== effect.value.path,
        });
      }
    }
    return buildMentionState(mentions);
  },
  provide: (field) => [
    EditorView.decorations.from(field, (value) => value.decorations),
    EditorView.atomicRanges.of((view) => view.state.field(field).mentions),
  ],
});

function buildMentionState(mentions: RangeSet<Mention>): MentionState {
  const decorations: ReturnType<Decoration['range']>[] = [];
  mentions.between(0, Infinity, (from, to, mention) => {
    decorations.push(Decoration.replace({ widget: new MentionWidget(mention.path) }).range(from, to));
  });
  return { mentions, decorations: Decoration.set(decorations, true) };
}

function keepMentionMarkers(mentions: RangeSet<Mention>, doc: EditorState['doc']) {
  const kept: ReturnType<Mention['range']>[] = [];
  mentions.between(0, doc.length, (from, to, mention) => {
    if (doc.sliceString(from, to) === MENTION) kept.push(mention.range(from, to));
  });
  return RangeSet.of(kept, true);
}

function serialize(state: EditorState) {
  const { mentions } = state.field(mentionField);
  let cursor = 0;
  let text = '';
  mentions.between(0, state.doc.length, (from, to, mention) => {
    text += state.doc.sliceString(cursor, from) + `@${mention.path}`;
    cursor = to;
  });
  return text + state.doc.sliceString(cursor);
}

function mentionQuery(state: EditorState): MentionQuery {
  const selection = state.selection.main;
  if (!selection.empty) return null;
  const before = state.doc.sliceString(0, selection.head);
  const match = /(^|\s)@([^\s@]*)$/.exec(before);
  return match ? { q: match[2], from: selection.head - match[2].length } : null;
}

function deleteMentionSelection(view: EditorView, backward: boolean) {
  const selection = view.state.selection.main;
  const { mentions } = view.state.field(mentionField);
  let from = selection.from;
  let to = selection.to;
  if (selection.empty) {
    const targets: { from: number; to: number }[] = [];
    mentions.between(0, view.state.doc.length, (mentionFrom, mentionTo) => {
      if ((backward && mentionTo === selection.head) || (!backward && mentionFrom === selection.head)) {
        targets.push({ from: mentionFrom, to: mentionTo });
      }
    });
    const target = targets[0];
    if (!target) return false;
    from = target.from;
    to = target.to;
  }

  const removed: StateEffect<{ from: number; path: string }>[] = [];
  mentions.between(from, to, (mentionFrom, mentionTo, mention) => {
    if (mentionFrom < to && mentionTo > from) removed.push(removeMention.of({ from: mentionFrom, path: mention.path }));
  });
  if (!removed.length) return false;
  view.dispatch({ changes: { from, to }, effects: removed });
  return true;
}

export function MentionComposer({
  disabled,
  placeholder: placeholderText,
  onChange,
  onMentionChange,
  onMentionNavigate,
  onMentionAccept,
  onMentionDismiss,
  onShiftTab,
  onSubmit,
  mentionListboxId,
  activeMentionOptionId,
  mentionOpen,
  ref,
}: {
  disabled: boolean;
  placeholder: string;
  onChange: (text: string) => void;
  onMentionChange: (mention: MentionQuery) => void;
  onMentionNavigate: (direction: 1 | -1) => void;
  onMentionAccept: () => boolean;
  onMentionDismiss: () => void;
  onShiftTab: () => boolean;
  onSubmit: (text: string) => boolean;
  mentionListboxId?: string;
  activeMentionOptionId?: string;
  mentionOpen: boolean;
  ref: React.Ref<MentionComposerHandle>;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView>(null);
  const disabledRef = useRef(disabled);
  const onChangeRef = useRef(onChange);
  const onMentionChangeRef = useRef(onMentionChange);
  const onMentionNavigateRef = useRef(onMentionNavigate);
  const onMentionAcceptRef = useRef(onMentionAccept);
  const onMentionDismissRef = useRef(onMentionDismiss);
  const onShiftTabRef = useRef(onShiftTab);
  const onSubmitRef = useRef(onSubmit);
  const mentionOpenRef = useRef(mentionOpen);
  const mentionDismissedRef = useRef(false);
  const editableCompartmentRef = useRef(new Compartment());
  const placeholderCompartmentRef = useRef(new Compartment());

  disabledRef.current = disabled;
  onChangeRef.current = onChange;
  onMentionChangeRef.current = onMentionChange;
  onMentionNavigateRef.current = onMentionNavigate;
  onMentionAcceptRef.current = onMentionAccept;
  onMentionDismissRef.current = onMentionDismiss;
  onShiftTabRef.current = onShiftTab;
  onSubmitRef.current = onSubmit;
  mentionOpenRef.current = mentionOpen;

  function submit() {
    const view = viewRef.current;
    if (!view || !onSubmitRef.current(serialize(view.state))) return;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length } });
  }

  useImperativeHandle(ref, () => ({
    focus: () => viewRef.current?.focus(),
    insertMention: (path, query) => {
      const view = viewRef.current;
      if (!view) return;
      const from = query.from - 1;
      view.dispatch({
        changes: { from, to: view.state.selection.main.head, insert: MENTION + ' ' },
        effects: addMention.of({ from, path }),
        selection: { anchor: from + MENTION.length + 1 },
      });
      view.focus();
    },
    submit,
  }));

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const currentMentionQuery = () => {
      const view = viewRef.current;
      return view && mentionOpenRef.current ? mentionQuery(view.state) : null;
    };
    const view = new EditorView({
      state: EditorState.create({
        extensions: [
          history(),
          invertedEffects.of((transaction) => transaction.effects.flatMap((effect) => {
            if (effect.is(addMention)) return [removeMention.of(effect.value)];
            if (effect.is(removeMention)) return [addMention.of(effect.value)];
            return [];
          })),
          mentionField,
          EditorView.lineWrapping,
          placeholderCompartmentRef.current.of(placeholder(placeholderText)),
          editableCompartmentRef.current.of(EditorView.editable.of(!disabledRef.current)),
          keymap.of([
            {
              key: 'ArrowDown',
              run: () => {
                if (!currentMentionQuery()) return false;
                onMentionNavigateRef.current(1);
                return true;
              },
            },
            {
              key: 'ArrowUp',
              run: () => {
                if (!currentMentionQuery()) return false;
                onMentionNavigateRef.current(-1);
                return true;
              },
            },
            {
              key: 'Enter',
              run: () => {
                if (currentMentionQuery() && onMentionAcceptRef.current()) return true;
                if (disabledRef.current) return true;
                submit();
                return true;
              },
            },
            {
              key: 'Tab',
              run: () => currentMentionQuery() ? onMentionAcceptRef.current() : false,
            },
            { key: 'Shift-Tab', run: () => onShiftTabRef.current() },
            {
              key: 'Escape',
              run: () => {
                if (!currentMentionQuery()) return false;
                mentionDismissedRef.current = true;
                onMentionDismissRef.current();
                return true;
              },
            },
            { key: 'Backspace', run: (view) => deleteMentionSelection(view, true) },
            { key: 'Delete', run: (view) => deleteMentionSelection(view, false) },
            ...defaultKeymap,
            ...historyKeymap,
          ]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              mentionDismissedRef.current = false;
              onChangeRef.current(serialize(update.state));
            }
            if (update.docChanged || update.selectionSet) {
              onMentionChangeRef.current(mentionDismissedRef.current ? null : mentionQuery(update.state));
            }
          }),
          EditorView.theme({
            '&': { minHeight: '36px', maxHeight: '160px', font: 'inherit', fontSize: '13px' },
            '&.cm-focused': { outline: 'none' },
            '.cm-scroller': { overflow: 'auto', fontFamily: 'inherit', lineHeight: '1.5' },
            '.cm-content': { minHeight: '30px', padding: '6px 2px 0', caretColor: 'var(--fg)' },
            '.cm-placeholder': { color: 'var(--muted)' },
          }),
          EditorView.contentAttributes.of({ 'aria-label': 'Message agent' }),
        ],
      }),
      parent: host,
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  // The editor owns its document; callbacks are kept current in refs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    viewRef.current?.dispatch({ effects: editableCompartmentRef.current.reconfigure(EditorView.editable.of(!disabled)) });
  }, [disabled]);

  useEffect(() => {
    viewRef.current?.dispatch({ effects: placeholderCompartmentRef.current.reconfigure(placeholder(placeholderText)) });
  }, [placeholderText]);

  useEffect(() => {
    const input = viewRef.current?.contentDOM;
    if (!input) return;
    if (!mentionOpen) {
      input.removeAttribute('role');
      input.removeAttribute('aria-autocomplete');
      input.removeAttribute('aria-haspopup');
      input.removeAttribute('aria-controls');
      input.removeAttribute('aria-expanded');
      input.removeAttribute('aria-activedescendant');
      return;
    }
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-haspopup', 'listbox');
    input.setAttribute('aria-expanded', String(Boolean(mentionListboxId)));
    if (mentionListboxId) input.setAttribute('aria-controls', mentionListboxId);
    if (activeMentionOptionId) input.setAttribute('aria-activedescendant', activeMentionOptionId);
  }, [activeMentionOptionId, mentionListboxId, mentionOpen]);

  return <div ref={hostRef} className="agent-input" />;
}
