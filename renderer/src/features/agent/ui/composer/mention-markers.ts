/** The marker layer under the composer's chips. A mention is one atomic
 *  character in the CodeMirror document carrying a `Mention` range value, so
 *  it moves with the text and deletes as a single unit. This module owns that
 *  representation and the questions asked of it — what the document
 *  serializes to, which paths it carries, and which `@` or `/` query the
 *  caret currently sits in — and nothing about how a chip looks. */
import { EditorState, RangeSet, RangeValue, StateEffect, StateField } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

import type { ContextStatus, MentionQuery } from '@/features/agent/domain/context';

/** The one character a marker replaces: an object-replacement placeholder, so
 *  no text a person can type is ever mistaken for a chip. */
export const MENTION = '\uFFFC';

export type MarkerKind = 'file' | 'skill';

export class Mention extends RangeValue {
  // Text typed at the chip's right edge stays outside the marker range;
  // otherwise mapping grows the range and keepMentionMarkers drops it.
  override endSide = -1;

  constructor(
    /** The mentioned path, or — for a skill marker — the skill's label. */
    readonly path: string,
    readonly fresh: boolean,
    readonly kind: MarkerKind = 'file',
  ) {
    super();
  }

  override eq(other: Mention) {
    return this.path === other.path && this.kind === other.kind;
  }
}

export interface MentionEffect {
  from: number;
  path: string;
  fresh: boolean;
  kind: MarkerKind;
}

export const addMention = StateEffect.define<MentionEffect>({
  map: (value, changes) => ({ ...value, from: changes.mapPos(value.from, -1) }),
});

export const removeMention = StateEffect.define<MentionEffect>({
  map: (value, changes) => ({ ...value, from: changes.mapPos(value.from, -1) }),
});

export const setStatuses = StateEffect.define<Readonly<Record<string, ContextStatus>>>();

function keepMentionMarkers(mentions: RangeSet<Mention>, doc: EditorState['doc']) {
  const kept: ReturnType<Mention['range']>[] = [];
  mentions.between(0, doc.length, (from, to, mention) => {
    if (doc.sliceString(from, to) === MENTION) kept.push(mention.range(from, to));
  });
  return RangeSet.of(kept, true);
}

export const mentionField = StateField.define<RangeSet<Mention>>({
  create: () => RangeSet.empty,
  update: (value, transaction) => {
    let mentions = keepMentionMarkers(value.map(transaction.changes), transaction.state.doc);
    for (const effect of transaction.effects) {
      if (effect.is(addMention)) {
        mentions = mentions.update({
          add: [
            new Mention(effect.value.path, effect.value.fresh, effect.value.kind).range(
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

export const statusField = StateField.define<Readonly<Record<string, ContextStatus>>>({
  create: () => ({}),
  update: (value, transaction) => {
    for (const effect of transaction.effects) if (effect.is(setStatuses)) return effect.value;
    return value;
  },
});

export function serialize(state: EditorState): string {
  let cursor = 0;
  let text = '';
  state.field(mentionField).between(0, state.doc.length, (from, to, mention) => {
    text += state.doc.sliceString(cursor, from);
    // The skill leaves no text behind, and takes the single space that seats
    // it with it, so the serialized draft is exactly what was typed.
    if (mention.kind === 'skill') {
      cursor = state.doc.sliceString(to, to + 1) === ' ' ? to + 1 : to;
      return;
    }
    text += `@${mention.path}`;
    cursor = to;
  });
  return text + state.doc.sliceString(cursor);
}

export function mentionPaths(state: EditorState): Set<string> {
  const paths = new Set<string>();
  state.field(mentionField).between(0, state.doc.length, (_from, _to, mention) => {
    if (mention.kind === 'file') paths.add(mention.path);
  });
  return paths;
}

/** The one skill marker, when the document carries it. */
export function skillMarker(state: EditorState): { from: number; to: number; path: string } | null {
  let marker: { from: number; to: number; path: string } | null = null;
  state.field(mentionField).between(0, state.doc.length, (from, to, mention) => {
    if (mention.kind === 'skill' && !marker) marker = { from, path: mention.path, to };
  });
  return marker;
}

export function mentionQuery(state: EditorState, skillsEnabled = false): MentionQuery | null {
  const selection = state.selection.main;
  if (!selection.empty) return null;
  const before = state.doc.sliceString(0, selection.head);
  const match = /(^|\s)([@/])([^\s@/]*)$/u.exec(before);
  if (!match) return null;
  const skill = match[2] === '/';
  if (skill && !skillsEnabled) return null;
  const query = match[3] ?? '';
  return {
    from: selection.head - query.length - 1,
    kind: skill ? 'skill' : 'mention',
    query,
  };
}
