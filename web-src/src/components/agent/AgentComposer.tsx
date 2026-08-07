import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Button, ListBox, ListBoxItem, Menu, MenuItem, MenuTrigger, Popover, VisuallyHidden } from 'react-aria-components';
import {
  ArrowUpIcon, BoltIcon, BotIcon, CheckIcon, ChevronDownIcon, ClipboardListIcon, CodeIcon, DumbbellIcon,
  FileGenericIcon, FolderIcon, HandIcon, LibraryIcon, PlusIcon, StopIcon,
} from '../../icons';
import { cn } from '../../lib/utils';
import type { FileMeta, FolderMeta } from '../../api';
import { ImageLightbox } from '../ImageLightbox';
import {
  Menu as SharedMenu,
  MenuItem as SharedMenuItem,
  MenuPopup as SharedMenuPopup,
  MenuPortal as SharedMenuPortal,
  MenuPositioner as SharedMenuPositioner,
  MenuTrigger as SharedMenuTrigger,
} from '../ui/menu';
import { baseName } from './attachments';
import { changedEffortSelection, effortLabel, effortMenuState, effortOptions } from './effortMenuState';
import {
  folderDisplayName,
  folderScope,
  LIBRARY_SCOPE,
  scopeDisplayName,
  scopePillAriaLabel,
  shortenFolderPath,
  type ChatScope,
  type LibraryFolderOption,
} from './folderState';
import { MentionComposer, type MentionComposerHandle, type MentionQuery } from './MentionComposer';
import { rankMentionSuggestions } from './mentionRanking';
import {
  attachChipClass, attachIconClass, attachImageChipClass, attachImagePreviewClass,
  attachImageRemoveClass, attachNameClass, attachRemoveClass, iconGhostButtonClass,
} from './panelStyles';
import type { AgentModel, AgentSkill, Attachment, EffortLevel, PermMode } from './types';
import { modelMenuLabel } from './modelState';

const MODES: { id: PermMode; label: string; desc: string; Icon: typeof HandIcon }[] = [
  { id: 'default', label: 'Ask', desc: 'Ask before edits or higher-risk actions', Icon: HandIcon },
  { id: 'acceptEdits', label: 'Edit', desc: 'Apply file edits without asking each time', Icon: CodeIcon },
  { id: 'plan', label: 'Plan', desc: 'Explore and propose a plan before changing files', Icon: ClipboardListIcon },
  { id: 'auto', label: 'Auto', desc: 'Let the agent decide when approval is needed', Icon: BoltIcon },
];

/* Composer-bar pills. Each trigger carries a leading icon plus a
 * control-naming title/aria-label so adjacent "Default" values stay
 * distinguishable. Model and effort change the next native session, so
 * they get the accent-tinted emphasis treatment; the permission-mode pill
 * stays a quiet utility control. */
const pillClass =
  'inline-flex cursor-pointer items-center gap-1 rounded-md border-0 bg-transparent px-1.5 py-0.75 text-xs whitespace-nowrap text-muted-foreground enabled:hover:bg-muted enabled:hover:text-foreground disabled:cursor-default';
const pillEmphasisClass =
  'min-h-7 border border-accent/35 bg-accent/8 text-foreground enabled:hover:border-accent enabled:hover:bg-accent/15 enabled:hover:text-foreground';
const pillLockedClass = 'cursor-default opacity-60';
const pillIconClass = 'size-3.5 shrink-0';
const pillChevronClass = '-ml-px size-3 shrink-0 opacity-75';

/* Upward menus anchored to the pills. */
const menuPopupClass =
  'z-20 w-80 max-w-[calc(100vw-24px)] rounded-xl border border-border bg-card p-1.5 shadow-elevation';
const menuHeadClass = 'flex flex-col items-start gap-0.5 px-2 pt-1 pb-2 text-sm';
const optClass =
  'flex w-full cursor-pointer items-start gap-2.5 rounded-lg border-0 bg-transparent p-2 text-left text-foreground hover:bg-muted data-focused:bg-muted data-highlighted:bg-muted';
const optActiveClass =
  'bg-accent/12 shadow-[inset_2px_0_0_var(--accent)] hover:bg-accent/12 data-focused:bg-accent/12 data-highlighted:bg-accent/12';
const optIconClass = 'mt-px size-4.5 shrink-0 text-muted-foreground';
const optTextClass = 'flex min-w-0 flex-1 flex-col gap-0.5';
const optTitleClass = 'text-base font-medium';
const optDescClass = 'text-xs leading-snug text-muted-foreground';
const optCheckClass = 'mt-0.5 size-4 shrink-0 text-accent';

/* Explicit, touch-friendly effort choices — never tiny slider dots. */
const effortChoiceClass =
  'min-h-7.5 shrink-0 cursor-pointer rounded-md border border-border bg-transparent px-2 py-1 text-xs text-muted-foreground transition-colors duration-fast hover:bg-muted hover:text-foreground';
const effortChoiceCurClass =
  'border-accent bg-accent/15 font-semibold text-foreground hover:bg-accent/15 hover:text-foreground';

/* Neutral send button — accent only on hover-when-ready (VSCode-style). */
const sendClass =
  'grid size-7 shrink-0 cursor-pointer place-items-center rounded-lg border p-0 [&_svg]:size-4.5';
const sendReadyClass =
  'border-border bg-muted text-foreground enabled:hover:border-accent enabled:hover:bg-accent enabled:hover:text-primary-foreground disabled:cursor-default disabled:opacity-40';
const sendStopClass = 'border-destructive bg-destructive text-primary-foreground';

function AccessMenu({
  mode, open, disabled, onOpenChange, onPick,
}: {
  mode: PermMode;
  open: boolean;
  disabled: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (m: PermMode) => void;
}) {
  const active = MODES.find((m) => m.id === mode) ?? MODES[0];
  const ActiveIcon = active.Icon;
  return (
    <MenuTrigger isOpen={open} onOpenChange={onOpenChange}>
      <Button
        className={pillClass}
        isDisabled={disabled}
        aria-label={`Permission mode: ${active.label} — ${active.desc}`}
      >
        <ActiveIcon className={pillIconClass} />
        {active.label}
        <ChevronDownIcon className={pillChevronClass} />
      </Button>
      <Popover className={menuPopupClass} placement="top end">
        <div className={menuHeadClass}>
          <span className="font-semibold text-foreground">Permission mode</span>
        </div>
        <Menu aria-label="Permission mode" selectionMode="single" selectedKeys={[mode]} onAction={(key) => onPick(key as PermMode)}>
          {MODES.map((m) => {
            const Icon = m.Icon;
            return (
              <MenuItem
                key={m.id}
                id={m.id}
                className={({ isSelected }) => cn(optClass, isSelected && optActiveClass)}
                textValue={m.label}
              >
                <Icon className={optIconClass} />
                <span className={optTextClass}>
                  <span className={optTitleClass}>{m.label}</span>
                  <span className={optDescClass}>{m.desc}</span>
                </span>
                {m.id === mode && <CheckIcon className={optCheckClass} />}
              </MenuItem>
            );
          })}
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}

function EffortBar({ effort, efforts, onSet }: { effort?: EffortLevel; efforts: EffortLevel[]; onSet: (l?: EffortLevel) => void }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-accent/4 p-2">
      <DumbbellIcon className="size-4 shrink-0 text-muted-foreground" />
      <span className="flex-1 text-sm text-foreground">
        Effort <span className="text-muted-foreground">({effort ? effortLabel(effort) : 'Default'})</span>
      </span>
      <ListBox
        className="flex flex-wrap items-center justify-end gap-1 py-0.5"
        aria-label="Effort"
        selectionMode="single"
        selectedKeys={[effort ?? '__default__']}
        onSelectionChange={(keys) => {
          const next = changedEffortSelection(keys, effort, efforts);
          if (next !== null) onSet(next);
        }}
      >
        <ListBoxItem
          id="__default__"
          className={({ isSelected }) => cn(effortChoiceClass, isSelected && effortChoiceCurClass)}
          textValue="Default"
        >
          Default
        </ListBoxItem>
        {efforts.map((lv) => (
          <ListBoxItem
            key={lv}
            id={lv}
            className={({ isSelected }) => cn(effortChoiceClass, isSelected && effortChoiceCurClass)}
            aria-label={effortLabel(lv)}
            textValue={effortLabel(lv)}
          >
            {effortLabel(lv)}
          </ListBoxItem>
        ))}
      </ListBox>
    </div>
  );
}

function EffortMenu({
  effort, efforts, open, disabled, locked, onOpenChange, onSetEffort,
}: {
  effort?: EffortLevel;
  efforts: EffortLevel[];
  open: boolean;
  disabled: boolean;
  locked: boolean;
  onOpenChange: (open: boolean) => void;
  onSetEffort: (level?: EffortLevel) => void;
}) {
  const state = effortMenuState({ open, disabled, locked });
  const label = effort ? effortLabel(effort) : 'Default';
  return (
    <MenuTrigger isOpen={state.isOpen} onOpenChange={onOpenChange}>
      <Button
        className={cn(pillClass, pillEmphasisClass, locked && pillLockedClass)}
        isDisabled={state.triggerDisabled}
        aria-label={`Reasoning effort: ${label}`}
      >
        <DumbbellIcon className={pillIconClass} />
        {effort ? label : 'Effort: Default'}
        <ChevronDownIcon className={pillChevronClass} />
      </Button>
      <Popover className={cn(menuPopupClass, 'w-75 px-2 py-1.5')} placement="top end">
        <div>
          <EffortBar effort={effort} efforts={efforts} onSet={onSetEffort} />
        </div>
      </Popover>
    </MenuTrigger>
  );
}

function ModelMenu({ selectedModel, activeModel, models, locked, disabled, resumedSession, onSetModel }: {
  selectedModel?: string;
  activeModel?: string;
  models: AgentModel[];
  locked: boolean;
  disabled: boolean;
  resumedSession: boolean;
  onSetModel: (model?: string) => void;
}) {
  const defaultSelected = !selectedModel;
  const label = modelMenuLabel(models, selectedModel, activeModel, resumedSession);
  return (
    <SharedMenu>
      <SharedMenuTrigger
        className={cn(pillClass, pillEmphasisClass, 'max-w-40', locked && pillLockedClass)}
        disabled={disabled || locked}
        aria-label={`Model: ${label}`}
        title={`Model — ${label}`}
      >
        <BotIcon className={pillIconClass} />
        <span className="truncate">{label === 'Default' ? 'Model: Default' : label}</span>
        <ChevronDownIcon className={pillChevronClass} />
      </SharedMenuTrigger>
      <SharedMenuPortal>
        <SharedMenuPositioner side="top" align="end" sideOffset={6} collisionPadding={8}>
          <SharedMenuPopup className="max-h-[min(360px,55vh)] w-85 max-w-[calc(100vw-24px)] overflow-auto p-1.5" aria-label="Model">
            <div className={menuHeadClass}><span className="font-semibold text-foreground">Model</span></div>
            <SharedMenuItem label="Default" className={cn(optClass, defaultSelected && optActiveClass)} onClick={() => onSetModel(undefined)}>
            <span className={optTextClass}><span className={optTitleClass}>Default</span><span className={optDescClass}>Use this runtime’s configured model</span></span>
            {defaultSelected && <CheckIcon className={optCheckClass} />}
            </SharedMenuItem>
            {models.map((entry) => (
              <SharedMenuItem key={entry.id} label={entry.label} className={cn(optClass, selectedModel === entry.id && optActiveClass)} onClick={() => onSetModel(entry.id)}>
              <span className={optTextClass}><span className={optTitleClass}>{entry.label}</span>{entry.description && <span className={optDescClass}>{entry.description}</span>}</span>
              {selectedModel === entry.id && <CheckIcon className={optCheckClass} />}
              </SharedMenuItem>
            ))}
          </SharedMenuPopup>
        </SharedMenuPositioner>
      </SharedMenuPortal>
    </SharedMenu>
  );
}

/** Cursor-style session-scope picker. A new session binds the picked
 * scope — a library folder, or "Library" for a library-wide chat
 * (default: the window's current folder, else Library); once the chat has
 * content the pill stays visible but locked — a conversation never
 * rebinds. Same shared Base UI menu adapter as the model pill. */
function ScopeMenu({ scope, entries, homeDir, locked, disabled, onSetScope }: {
  scope: ChatScope;
  entries: LibraryFolderOption[];
  homeDir: string;
  locked: boolean;
  disabled: boolean;
  onSetScope: (scope: ChatScope) => void;
}) {
  const name = scopeDisplayName(scope);
  const label = scopePillAriaLabel(scope, locked);
  const isLibrary = scope.kind === 'library';
  return (
    <SharedMenu>
      <SharedMenuTrigger
        className={cn(pillClass, 'max-w-40', locked && pillLockedClass)}
        disabled={disabled || locked}
        aria-label={label}
        title={isLibrary
          ? 'Session scope — the whole library'
          : `Session folder — ${shortenFolderPath(scope.path, homeDir)}`}
      >
        {isLibrary ? <LibraryIcon className={pillIconClass} /> : <FolderIcon className={pillIconClass} />}
        <span className="truncate">{name}</span>
        <ChevronDownIcon className={pillChevronClass} />
      </SharedMenuTrigger>
      <SharedMenuPortal>
        <SharedMenuPositioner side="top" align="start" sideOffset={6} collisionPadding={8}>
          <SharedMenuPopup className="max-h-[min(360px,55vh)] w-85 max-w-[calc(100vw-24px)] overflow-auto p-1.5" aria-label="Session scope">
            <div className={menuHeadClass}><span className="font-semibold text-foreground">Session scope</span></div>
            <SharedMenuItem label="Library" className={cn(optClass, isLibrary && optActiveClass)} onClick={() => onSetScope(LIBRARY_SCOPE)}>
            <LibraryIcon className={optIconClass} />
            <span className={optTextClass}><span className={optTitleClass}>Library</span><span className={optDescClass}>Chat across your whole library</span></span>
            {isLibrary && <CheckIcon className={optCheckClass} />}
            </SharedMenuItem>
            {entries.length > 0 && <div className="mx-2 my-1 border-t border-border" role="separator" />}
            {entries.map((entry) => {
              const active = scope.kind === 'folder' && scope.path === entry.path;
              return (
                <SharedMenuItem key={entry.path} label={folderDisplayName(entry.path)} className={cn(optClass, active && optActiveClass)} onClick={() => onSetScope(folderScope(entry.path))}>
                <FolderIcon className={optIconClass} />
                <span className={optTextClass}><span className={optTitleClass}>{folderDisplayName(entry.path)}</span><span className={optDescClass}>{shortenFolderPath(entry.path, homeDir)}</span></span>
                {active && <CheckIcon className={optCheckClass} />}
                </SharedMenuItem>
              );
            })}
          </SharedMenuPopup>
        </SharedMenuPositioner>
      </SharedMenuPortal>
    </SharedMenu>
  );
}

export function AgentComposer({
  phase, disabled, turnActive, active, mode, onSetMode, effort, onSetEffort,
  effortLocked, supportedEfforts, selectedModel, activeModel, models, modelLocked, modelNotice, resumedSession, onSetModel, sessionScope, folderEntries, folderLocked, folderHomeDir, onSetScope, onDraftChange, mentionFiles, mentionFolders, skills, skillState, onRefreshSkills, attachments, uploading, agentShortName, showModeMenu, showEffortMenu, showModelMenu, prefill, hero, onPickFiles, onPasteImages, onFocusChange, onRemoveAttachment, onSend, onStop,
}: {
  phase: 'connecting' | 'live' | 'closed';
  disabled: boolean;
  turnActive: boolean;
  active: boolean;
  mode: PermMode;
  onSetMode: (mode: PermMode) => void;
  effort?: EffortLevel;
  onSetEffort: (level?: EffortLevel) => void;
  effortLocked: boolean;
  supportedEfforts?: string[];
  selectedModel?: string;
  activeModel?: string;
  models: AgentModel[];
  modelLocked: boolean;
  modelNotice: string | null;
  resumedSession: boolean;
  onSetModel: (model?: string) => void;
  /** The scope this tab's session is (or will be) bound to. */
  sessionScope: ChatScope;
  folderEntries: LibraryFolderOption[];
  folderLocked: boolean;
  folderHomeDir: string;
  onSetScope: (scope: ChatScope) => void;
  /** Reports whether the composer holds unsent draft text, so the tab
   * model can freeze a drafted tab's scope and exclude it from blank-tab
   * reuse. */
  onDraftChange?: (hasText: boolean) => void;
  /** File/folder listing that feeds `@` mention ranking. For a tab bound to
   * another library folder this is the SESSION folder's listing, not the
   * window's; empty for a library-wide chat (mentions disabled there). */
  mentionFiles: FileMeta[];
  mentionFolders: FolderMeta[];
  skills: AgentSkill[];
  skillState: 'available' | 'empty' | 'failed';
  onRefreshSkills: () => void;
  attachments: Attachment[];
  uploading: boolean;
  agentShortName: string;
  showModeMenu: boolean;
  showEffortMenu: boolean;
  showModelMenu: boolean;
  /** Empty-state starter template. Prefills the draft only — never sends. */
  prefill?: { text: string; nonce: number } | null;
  /** Empty-chat layout: AgentView centers the composer mid-panel, so the
   * root sizes itself to the hero column instead of the `agent-composer`
   * chat-primary width hook. Same mounted instance in both layouts. */
  hero?: boolean;
  onPickFiles: (files: File[]) => void;
  onPasteImages: (files: File[]) => void;
  onFocusChange: (focused: boolean) => void;
  onRemoveAttachment: (path: string) => void;
  onSend: (text: string, skill?: string) => void;
  onStop: () => void;
}) {
  const [text, setText] = useState('');
  const composerRef = useRef<MentionComposerHandle>(null);
  const mentionListboxId = useId();
  const [mention, setMention] = useState<MentionQuery>(null);
  const [activeMentionIndex, setActiveMentionIndex] = useState(0);
  const [modeOpen, setModeOpen] = useState(false);
  const [effortOpen, setEffortOpen] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<AgentSkill>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mentionListRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (active) composerRef.current?.focus(); }, [active]);

  useEffect(() => {
    if (effortLocked) setEffortOpen(false);
  }, [effortLocked]);

  // Starter-suggestion prefill: replace the draft and keep focus in the
  // editor so typing continues naturally. Sending stays a user action.
  useEffect(() => {
    if (prefill) composerRef.current?.setText(prefill.text);
  }, [prefill]);

  function cycleMode() {
    const i = MODES.findIndex((m) => m.id === mode);
    onSetMode(MODES[(i + 1) % MODES.length].id);
  }

  const suggestions = useMemo(() => {
    if (!mention || mention.kind !== 'mention') return [];
    return rankMentionSuggestions(mentionFiles, mentionFolders, mention.q);
  }, [mention, mentionFiles, mentionFolders]);

  const skillSuggestions = useMemo(() => mention?.kind === 'skill'
    ? skills.filter((skill) => skill.label.toLowerCase().includes(mention.q.toLowerCase()) || (skill.description ?? '').toLowerCase().includes(mention.q.toLowerCase()))
    : [], [mention, skills]);
  const choices = mention?.kind === 'skill' ? skillSuggestions : suggestions;

  const activeSuggestionIndex = Math.min(activeMentionIndex, Math.max(choices.length - 1, 0));
  const compatibleEfforts = effortOptions(supportedEfforts);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const list = mentionListRef.current;
      const active = list?.querySelector<HTMLElement>('.agent-mention-item.active');
      if (!list || !active) return;
      // `offsetTop` is relative to the positioned popup, not necessarily this
      // scroll container. Let the browser find the containing scrollport so a
      // selected row never lands partly above or below the visible list.
      active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
    return () => cancelAnimationFrame(frame);
  }, [activeSuggestionIndex, choices.length]);

  const placeholder = phase === 'connecting'
    ? 'Connecting…'
    : phase === 'closed'
      ? 'Reconnect to continue…'
      : turnActive
        ? 'Ask for follow-up changes'
        : `Message ${agentShortName}…`;

  function pickMention(path: string) {
    if (!mention || mention.kind !== 'mention') return;
    composerRef.current?.insertMention(path, mention);
    setMention(null);
  }
  function submit(t: string) {
    const trimmed = t.trim();
    if ((!trimmed && attachments.length === 0 && !selectedSkill) || disabled || uploading) return false;
    onSend(trimmed, selectedSkill?.id);
    setSelectedSkill(undefined);
    setMention(null);
    return true;
  }

  function moveMention(direction: 1 | -1) {
    if (!choices.length) return;
    setActiveMentionIndex((index) => (index + direction + choices.length) % choices.length);
  }

  return (
    // `agent-composer` is a layout hook: the chat-primary grid rules in
    // styles/chat.css center it to the readable transcript width. In hero
    // mode the empty-state column (656px = 640px content + own padding)
    // replaces that hook so the composer centers mid-panel.
    <div className={cn('relative bg-pane p-2', hero ? 'mx-auto w-[min(656px,100%)]' : 'agent-composer')}>
      {mention && (choices.length > 0 || mention.kind === 'skill') && (
        <div className="agent-mention">
          <div className="agent-mention-head">
            <span>{mention.kind === 'skill' ? 'Available skills' : 'Files and folders'}</span>
            <span>{choices.length ? '↑↓ navigate · Enter select · Esc dismiss' : 'Esc dismiss'}</span>
          </div>
          {choices.length > 0 && <VisuallyHidden>
            <div role="status">
              {`${mention.kind === 'skill' ? (skillSuggestions[activeSuggestionIndex]?.label ?? '') : baseName(suggestions[activeSuggestionIndex].path)}, ${activeSuggestionIndex + 1} of ${choices.length}`}
            </div>
          </VisuallyHidden>}
          {choices.length > 0 ? <ListBox
            ref={mentionListRef}
            id={mentionListboxId}
            className="agent-mention-list"
            aria-label={mention.kind === 'skill' ? 'Matching available skills' : 'Matching library files and folders'}
            selectionMode="single"
            selectedKeys={[mention.kind === 'skill' ? skillSuggestions[activeSuggestionIndex]?.id ?? '' : suggestions[activeSuggestionIndex].path]}
            onAction={(key) => { if (mention.kind === 'skill') { const skill = skills.find((item) => item.id === String(key)); if (skill) { setSelectedSkill(skill); composerRef.current?.insertSkill(skill.label, mention); setMention(null); } } else pickMention(String(key)); }}
          >
            {mention.kind === 'skill' ? skillSuggestions.map((skill, index) => (
              <ListBoxItem key={skill.id} id={skill.id} className={({ isSelected }) => 'agent-mention-item' + (isSelected ? ' active' : '')} textValue={skill.label}><FileGenericIcon className="agent-mention-icon" /><span className="agent-mention-text"><span className="agent-mention-name">{skill.label}</span>{skill.description && <span className="agent-mention-path">{skill.description}</span>}</span></ListBoxItem>
            )) : suggestions.map((suggestion, index) => (
              <ListBoxItem
                key={suggestion.path}
                id={suggestion.path}
                className={({ isSelected }) => 'agent-mention-item' + (isSelected ? ' active' : '')}
                textValue={suggestion.path}
              >
                {suggestion.kind === 'folder'
                  ? <FolderIcon className="agent-mention-icon" />
                  : <FileGenericIcon className="agent-mention-icon" />}
                <span className="agent-mention-text">
                  <span className="agent-mention-name">{baseName(suggestion.path)}</span>
                  <span className="agent-mention-path">{suggestion.path}</span>
                </span>
              </ListBoxItem>
            ))}
          </ListBox> : (
            <div className="agent-mention-empty" role="status">
              {skillState === 'failed' ? <><span>Could not load skills.</span><Button className="agent-mention-retry" onPress={onRefreshSkills}>Retry</Button></> : <span>No skills are available for this folder.</span>}
            </div>
          )}
        </div>
      )}
      <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-background px-2 pt-2 pb-1.5 focus-within:border-accent">
        {(attachments.length > 0 || uploading) && (
          <div className="flex flex-wrap items-center gap-1">
            {attachments.map((a) => a.previewUrl ? (
              <span key={a.path} className={attachImageChipClass}>
                <button
                  type="button"
                  className={attachImagePreviewClass}
                  aria-label={`Preview ${a.name}`}
                  onClick={() => setPreviewAttachment(a)}
                >
                  <img src={a.previewUrl} alt="" />
                </button>
                <Button
                  className={attachImageRemoveClass}
                  aria-label={`Remove ${a.name}`}
                  onPress={() => {
                    if (previewAttachment?.path === a.path) setPreviewAttachment(null);
                    onRemoveAttachment(a.path);
                  }}
                >
                  <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">
                    <path d="m2.25 2.25 7.5 7.5M9.75 2.25l-7.5 7.5" />
                  </svg>
                </Button>
              </span>
            ) : (
              <span key={a.path} className={attachChipClass} title={a.path}>
                <FileGenericIcon className={attachIconClass} />
                <span className={attachNameClass}>{a.name}</span>
                <Button className={attachRemoveClass} aria-label={`Remove ${a.name}`} onPress={() => onRemoveAttachment(a.path)}>×</Button>
              </span>
            ))}
            {uploading && <span className="text-xs text-muted-foreground">Uploading…</span>}
          </div>
        )}
        <MentionComposer
          ref={composerRef}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(next) => {
            setText(next);
            // Lift draft presence to the tab model: unsent text freezes the
            // tab's scope and disqualifies it from blank-tab reuse.
            onDraftChange?.(Boolean(next.trim()));
          }}
          onMentionChange={(next) => {
            setMention(next);
            setActiveMentionIndex(0);
          }}
          onMentionNavigate={moveMention}
            onMentionAccept={() => {
            if (!mention) return false;
            if (!choices.length) return mention.kind === 'skill';
            if (mention.kind === 'skill') { const skill = skillSuggestions[activeSuggestionIndex]; if (!skill) return false; setSelectedSkill(skill); composerRef.current?.insertSkill(skill.label, mention); setMention(null); return true; }
            pickMention(suggestions[activeSuggestionIndex].path);
            return true;
          }}
            onMentionDismiss={() => setMention(null)}
          onSkillMarkerRemoved={() => setSelectedSkill(undefined)}
          onShiftTab={() => {
            if (!showModeMenu || disabled) return false;
            cycleMode();
            return true;
          }}
          onSubmit={submit}
          onPasteImages={onPasteImages}
          onFocusChange={onFocusChange}
          mentionOpen={Boolean(mention && (choices.length > 0 || mention.kind === 'skill'))}
          mentionListboxId={mention && choices.length ? mentionListboxId : undefined}
        />
        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            onPickFiles(Array.from(e.target.files ?? []));
            e.target.value = '';
          }}
        />
        {/* Action bar under the input. The negative side margins bleed the
          * top rule past the box padding so it spans edge to edge. */}
        <div className="-mx-2 flex items-center gap-1 border-t border-border px-2 pt-1.5">
          <Button
            className={iconGhostButtonClass}
            aria-label={uploading ? 'Uploading files' : 'Upload local files'}
            isDisabled={uploading}
            onPress={() => fileInputRef.current?.click()}
          >
            <PlusIcon />
          </Button>
          <span className="flex-1" />
          <ScopeMenu
            scope={sessionScope}
            entries={folderEntries}
            homeDir={folderHomeDir}
            locked={folderLocked}
            disabled={disabled}
            onSetScope={onSetScope}
          />
          {showModelMenu && <ModelMenu selectedModel={selectedModel} activeModel={activeModel} models={models} locked={modelLocked} disabled={disabled} resumedSession={resumedSession} onSetModel={onSetModel} />}
          {showModeMenu && (
            <AccessMenu
              mode={mode}
              open={modeOpen}
              disabled={disabled}
              onOpenChange={(open) => { setModeOpen(open); if (open) setEffortOpen(false); }}
              onPick={(m) => { onSetMode(m); setModeOpen(false); }}
            />
          )}
          {showEffortMenu && (
            <EffortMenu
              effort={effort}
              open={effortOpen}
              disabled={disabled}
              locked={effortLocked}
              efforts={compatibleEfforts}
              onOpenChange={(open) => { setEffortOpen(open); if (open) setModeOpen(false); }}
              onSetEffort={onSetEffort}
            />
          )}
          {turnActive ? (
            <Button className={cn(sendClass, sendStopClass)} aria-label="Stop agent" onPress={onStop}>
              <StopIcon />
            </Button>
          ) : (
            <Button
              className={cn(sendClass, sendReadyClass)}
              aria-label="Send message"
              isDisabled={disabled || uploading || (!text.trim() && attachments.length === 0 && !selectedSkill)}
              onPress={() => composerRef.current?.submit()}
            >
              <ArrowUpIcon />
            </Button>
          )}
        </div>
        {modelNotice && <div className="pt-1.5 text-xs leading-snug text-muted-foreground" role="status">{modelNotice}</div>}
      </div>
      {previewAttachment?.previewUrl && (
        <ImageLightbox
          src={previewAttachment.previewUrl}
          alt={previewAttachment.name}
          onClose={() => setPreviewAttachment(null)}
        />
      )}
    </div>
  );
}
