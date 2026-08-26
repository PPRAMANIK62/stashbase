/**
 * The composer's suggestion popup for `@` file/folder mentions and `/`
 * skills.
 *
 * One widget, one module: the query state, the ranked rows, the
 * keep-the-active-row-visible effect, and the panel itself. Its only tie to
 * the composer is the `MentionComposer` handle it inserts through and the
 * skill it reports back, so `AgentComposer` keeps the keyboard wiring
 * (navigate / accept / dismiss) and nothing else.
 *
 * `@` rows and `/` rows differ only in where they come from and what their
 * two lines say, so both normalize to one `MentionChoice` list up front.
 * That is what keeps the panel a single map instead of a skill-or-mention
 * ternary repeated at every row, key, label, and announcement.
 */
import { useEffect, useId, useMemo, useRef, useState, type RefObject } from 'react';
import { Button } from '@/common/components/ui/button';
import { FileGenericIcon, FolderIcon } from '@/common/components/icons';
import type { FileMeta, FolderMeta } from '@/common/api/api';
import { basename } from '@/common/lib/paths';
import type { MentionComposerHandle, MentionQuery } from '@/features/agent-panel/components/MentionComposer';
import { rankMentionSuggestions } from '@/features/agent-panel/lib/mentionRanking';
import type { AgentSkill } from '@/features/agent-panel/lib/types';
import { cn } from '@/common/lib/utils';

/** File/folder listing that feeds `@` mention ranking. For a tab bound to
 * another library folder this is the SESSION folder's listing, not the
 * window's; empty for a library-wide chat (mentions disabled there). */
export interface ComposerMentionSources {
  files: FileMeta[];
  folders: FolderMeta[];
}

/** `/` skill catalog for this session's folder. */
export interface ComposerSkillSource {
  list: AgentSkill[];
  state: 'available' | 'empty' | 'failed';
  onRefresh: () => void;
}

/** One suggestion row, whichever list it came from. `key` is what the
 *  insert path receives (a library path, or a skill id). */
interface MentionChoice {
  key: string;
  /** Primary line: the file's base name, or the skill's label. */
  name: string;
  /** Secondary line: the full path, or the skill's description. */
  detail?: string;
  icon: 'file' | 'folder';
}

export interface MentionSuggestionsState {
  /** The active `@`/`/` query, or null when the composer has none. */
  query: MentionQuery;
  choices: MentionChoice[];
  /** Index into `choices`, already clamped to the current list. */
  activeIndex: number;
  listboxId: string;
  activeOptionId: string | undefined;
  listRef: RefObject<HTMLUListElement | null>;
  /** Whether the panel is showing — a `/` query stays open with no rows so
   *  it can explain that the folder advertises no skills. */
  open: boolean;
  /** The listbox id the composer should advertise, or undefined when there
   *  is nothing to point `aria-controls` at. */
  composerListboxId: string | undefined;
  /** The option the editor's caret is 'on', for aria-activedescendant.
   * Focus never leaves the composer, so this is the only way a screen
   * reader learns which row Enter would take. */
  composerActiveOptionId: string | undefined;
  onQueryChange: (next: MentionQuery) => void;
  move: (direction: 1 | -1) => void;
  /** Accept the active row. Returns whether the key press was consumed. */
  accept: () => boolean;
  dismiss: () => void;
  pick: (key: string) => void;
}

/** One stable DOM id per option row, so the composer can point
 * `aria-activedescendant` at the row the caret is on. */
function mentionOptionId(listboxId: string, key: string): string {
  return `${listboxId}-${encodeURIComponent(key)}`;
}

export function useMentionSuggestions({ composerRef, mentions, skills, onSkillPicked }: {
  composerRef: RefObject<MentionComposerHandle | null>;
  mentions: ComposerMentionSources;
  skills: AgentSkill[];
  /** A `/` pick also arms the next turn's skill, which the composer owns. */
  onSkillPicked: (skill: AgentSkill) => void;
}): MentionSuggestionsState {
  const listboxId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState<MentionQuery>(null);
  const [requestedIndex, setRequestedIndex] = useState(0);

  const fileChoices = useMemo<MentionChoice[]>(() => {
    if (!query || query.kind !== 'mention') return [];
    return rankMentionSuggestions(mentions.files, mentions.folders, query.q).map((suggestion) => ({
      key: suggestion.path,
      name: basename(suggestion.path),
      detail: suggestion.path,
      icon: suggestion.kind === 'folder' ? 'folder' : 'file',
    }));
  }, [query, mentions.files, mentions.folders]);

  const skillChoices = useMemo<MentionChoice[]>(() => {
    if (query?.kind !== 'skill') return [];
    const needle = query.q.toLowerCase();
    return skills
      .filter((skill) => skill.label.toLowerCase().includes(needle) || (skill.description ?? '').toLowerCase().includes(needle))
      .map((skill) => ({ key: skill.id, name: skill.label, detail: skill.description, icon: 'file' }));
  }, [query, skills]);

  const choices = query?.kind === 'skill' ? skillChoices : fileChoices;
  const activeIndex = Math.min(requestedIndex, Math.max(choices.length - 1, 0));

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const list = listRef.current;
      const active = list?.querySelector<HTMLElement>('.agent-mention-item.active');
      if (!list || !active) return;
      // `offsetTop` is relative to the positioned popup, not necessarily this
      // scroll container. Let the browser find the containing scrollport so a
      // selected row never lands partly above or below the visible list.
      active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
    return () => cancelAnimationFrame(frame);
  }, [activeIndex, choices.length]);

  /** Turn the picked row into the composer's inline display token. */
  function pick(key: string) {
    if (!query) return;
    if (query.kind === 'skill') {
      const skill = skills.find((item) => item.id === key);
      if (!skill) return;
      onSkillPicked(skill);
      composerRef.current?.insertSkill(skill.label, query);
      setQuery(null);
      return;
    }
    composerRef.current?.insertMention(key, query);
    setQuery(null);
  }

  return {
    query,
    choices,
    activeIndex,
    listboxId,
    activeOptionId: choices.length ? mentionOptionId(listboxId, choices[activeIndex].key) : undefined,
    listRef,
    open: Boolean(query && (choices.length > 0 || query.kind === 'skill')),
    composerListboxId: query && choices.length ? listboxId : undefined,
    composerActiveOptionId: query && choices.length
      ? mentionOptionId(listboxId, choices[activeIndex].key)
      : undefined,
    onQueryChange: (next) => {
      setQuery(next);
      setRequestedIndex(0);
    },
    move: (direction) => {
      if (!choices.length) return;
      setRequestedIndex((index) => (index + direction + choices.length) % choices.length);
    },
    accept: () => {
      if (!query) return false;
      // An empty `/` panel still owns Enter: it is explaining the folder has
      // no skills, so the key must not send the draft behind it.
      if (!choices.length) return query.kind === 'skill';
      const choice = choices[activeIndex];
      if (!choice) return false;
      pick(choice.key);
      return true;
    },
    dismiss: () => setQuery(null),
    pick,
  };
}

export function MentionSuggestions({ state, skills }: {
  state: MentionSuggestionsState;
  skills: ComposerSkillSource;
}) {
  if (!state.open) return null;
  const { choices, activeIndex } = state;
  const isSkill = state.query?.kind === 'skill';
  return (
    <div className="agent-mention">
      <div className="flex justify-between gap-2 px-2 pt-1 pb-1.5 text-2xs text-muted-foreground">
        <span className="font-semibold text-foreground">{isSkill ? 'Available skills' : 'Files and folders'}</span>
        <span>{choices.length ? '↑↓ navigate · Enter select · Esc dismiss' : 'Esc dismiss'}</span>
      </div>
      {/* No sr-only status mirror of the active row here: the composer's
        * aria-activedescendant (MentionComposer) already announces each
        * option as the caret moves, and a parallel live region spoke every
        * row twice. */}
      {choices.length > 0 ? (
        /* Plain listbox markup, because the keyboard belongs to the EDITOR:
          * focus stays in CodeMirror and arrow keys move `activeIndex`
          * there, which is the ARIA combobox pattern. A widget that wants
          * focus for itself would fight the composer for it. */
        <ul
          ref={state.listRef}
          id={state.listboxId}
          className="agent-mention-list"
          role="listbox"
          aria-label={isSkill ? 'Matching available skills' : 'Matching library files and folders'}
        >
          {choices.map((choice, index) => (
            <li
              key={choice.key}
              id={mentionOptionId(state.listboxId, choice.key)}
              role="option"
              aria-selected={index === activeIndex}
              /* `agent-mention-item`/`active` are the keyboard-navigation
                 querySelector hook (above), not a look. Hover paints only
                 when the row is NOT the selected one: the two used to be
                 equal-specificity rules where selection won by source
                 order, and a plain `hover:` utility would win instead. */
              className={cn(
                'agent-mention-item flex w-full cursor-pointer items-start gap-1.5 rounded-md px-2 py-1.5 text-left',
                index === activeIndex ? 'active bg-active' : 'hover:bg-muted',
              )}
              // mousedown, not click: the composer must not lose focus to
              // the row before the pick lands.
              onMouseDown={(event) => { event.preventDefault(); state.pick(choice.key); }}
            >
              {/* 14 is the panel's standing chrome glyph; the 2px lift
                  seats it on the name's first baseline rather than on the
                  top of a two-line row. */}
              {choice.icon === 'folder'
                ? <FolderIcon className="mt-0.5 size-3.5 flex-none text-muted-foreground" />
                : <FileGenericIcon className="mt-0.5 size-3.5 flex-none text-muted-foreground" />}
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm text-foreground">{choice.name}</span>
                {choice.detail && <span className="truncate text-xs text-muted-foreground">{choice.detail}</span>}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex items-center justify-between gap-2 p-2 text-sm text-muted-foreground" role="status">
          {/* The `outline` recipe already IS this button — bordered, quiet
              neutral hover, the global focus halo. Only two of its
              decisions are wrong here: it fills with `background`, which
              splits from the popup's `card` surface in dark, and it steps
              its type down while this row does not. */}
          {skills.state === 'failed'
            ? <><span>Could not load skills.</span><Button variant="outline" size="xs" className="bg-transparent text-sm" onClick={skills.onRefresh}>Retry</Button></>
            : <span>No skills are available for this folder.</span>}
        </div>
      )}
    </div>
  );
}
