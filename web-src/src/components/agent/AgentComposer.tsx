import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Button, ListBox, ListBoxItem, Menu, MenuItem, MenuTrigger, Popover, VisuallyHidden } from 'react-aria-components';
import {
  ArrowUpIcon, BoltIcon, CheckIcon, ChevronDownIcon, ClipboardListIcon, CodeIcon, DumbbellIcon,
  FileGenericIcon, FolderIcon, HandIcon, PlusIcon, StopIcon,
} from '../../icons';
import { useApp } from '../../store/AppContext';
import { baseName } from './attachments';
import { MentionComposer, type MentionComposerHandle, type MentionQuery } from './MentionComposer';
import { rankMentionSuggestions } from './mentionRanking';
import type { Attachment, EffortLevel, PermMode } from './types';

const MODES: { id: PermMode; label: string; desc: string; Icon: typeof HandIcon }[] = [
  { id: 'default', label: 'Ask', desc: 'Ask before edits or higher-risk actions', Icon: HandIcon },
  { id: 'acceptEdits', label: 'Edit', desc: 'Apply file edits without asking each time', Icon: CodeIcon },
  { id: 'plan', label: 'Plan', desc: 'Explore and propose a plan before changing files', Icon: ClipboardListIcon },
  { id: 'auto', label: 'Auto', desc: 'Let the agent decide when approval is needed', Icon: BoltIcon },
];

const EFFORTS: EffortLevel[] = ['low', 'medium', 'high', 'xhigh', 'max'];
const EFFORT_LABEL: Record<EffortLevel, string> = {
  low: 'Low', medium: 'Medium', high: 'High', xhigh: 'X-High', max: 'Max',
};

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
      <Button className="agent-mode-btn" isDisabled={disabled}>
        <ActiveIcon className="agent-mode-icon" />
        {active.label}
        <ChevronDownIcon className="agent-mode-chevron" />
      </Button>
      <Popover className="agent-mode-menu" placement="top end">
        <div className="agent-mode-menu-head">
          <span>Access</span>
        </div>
        <Menu aria-label="Access level" selectionMode="single" selectedKeys={[mode]} onAction={(key) => onPick(key as PermMode)}>
          {MODES.map((m) => {
            const Icon = m.Icon;
            return (
              <MenuItem
                key={m.id}
                id={m.id}
                className={({ isSelected }) => 'agent-mode-opt' + (isSelected ? ' active' : '')}
                textValue={m.label}
              >
                <Icon className="agent-mode-opt-icon" />
                <span className="agent-mode-opt-text">
                  <span className="agent-mode-opt-title">{m.label}</span>
                  <span className="agent-mode-opt-desc">{m.desc}</span>
                </span>
                {m.id === mode && <CheckIcon className="agent-mode-opt-check" />}
              </MenuItem>
            );
          })}
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}

function EffortBar({ effort, onSet }: { effort: EffortLevel; onSet: (l: EffortLevel) => void }) {
  const cur = EFFORTS.indexOf(effort);
  return (
    <div className="agent-effort">
      <DumbbellIcon className="agent-effort-icon" />
      <span className="agent-effort-label">
        Effort <span className="agent-effort-level">({EFFORT_LABEL[effort]})</span>
      </span>
      <ListBox
        className="agent-effort-track"
        aria-label="Effort"
        selectionMode="single"
        selectedKeys={[effort]}
        onAction={(key) => onSet(key as EffortLevel)}
      >
        {EFFORTS.map((lv, i) => (
          <ListBoxItem
            key={lv}
            id={lv}
            className={({ isSelected }) =>
              'agent-effort-notch'
              + (i <= cur ? ' on' : '')
              + (isSelected ? ' cur' : '')
              + (lv === 'max' ? ' max' : '')
            }
            aria-label={EFFORT_LABEL[lv]}
            textValue={EFFORT_LABEL[lv]}
          />
        ))}
      </ListBox>
    </div>
  );
}

function EffortMenu({
  effort, open, disabled, locked, onOpenChange, onSetEffort,
}: {
  effort: EffortLevel;
  open: boolean;
  disabled: boolean;
  locked: boolean;
  onOpenChange: (open: boolean) => void;
  onSetEffort: (level: EffortLevel) => void;
}) {
  const unavailable = disabled || locked;
  return (
    <MenuTrigger isOpen={open && !unavailable} onOpenChange={onOpenChange}>
      <Button
        className={'agent-mode-btn agent-effort-btn' + (locked ? ' is-locked' : '')}
        isDisabled={unavailable}
      >
        <DumbbellIcon className="agent-mode-icon" />
        {EFFORT_LABEL[effort]}
        <ChevronDownIcon className="agent-mode-chevron" />
      </Button>
      <Popover className="agent-mode-menu effort-only" placement="top end">
        <div>
          <EffortBar effort={effort} onSet={onSetEffort} />
        </div>
      </Popover>
    </MenuTrigger>
  );
}

export function AgentComposer({
  phase, disabled, turnActive, active, mode, onSetMode, effort, onSetEffort,
  effortLocked, attachments, uploading, agentShortName, showModeMenu, showEffortMenu, onPickFiles, onRemoveAttachment, onSend, onStop,
}: {
  phase: 'connecting' | 'live' | 'closed';
  disabled: boolean;
  turnActive: boolean;
  active: boolean;
  mode: PermMode;
  onSetMode: (mode: PermMode) => void;
  effort: EffortLevel;
  onSetEffort: (level: EffortLevel) => void;
  effortLocked: boolean;
  attachments: Attachment[];
  uploading: boolean;
  agentShortName: string;
  showModeMenu: boolean;
  showEffortMenu: boolean;
  onPickFiles: (files: File[]) => void;
  onRemoveAttachment: (path: string) => void;
  onSend: (text: string) => void;
  onStop: () => void;
}) {
  const [text, setText] = useState('');
  const composerRef = useRef<MentionComposerHandle>(null);
  const mentionListboxId = useId();
  const { state } = useApp();
  const [mention, setMention] = useState<MentionQuery>(null);
  const [activeMentionIndex, setActiveMentionIndex] = useState(0);
  const [modeOpen, setModeOpen] = useState(false);
  const [effortOpen, setEffortOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeMentionRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (active) composerRef.current?.focus(); }, [active]);

  useEffect(() => {
    if (effortLocked) setEffortOpen(false);
  }, [effortLocked]);

  function cycleMode() {
    const i = MODES.findIndex((m) => m.id === mode);
    onSetMode(MODES[(i + 1) % MODES.length].id);
  }

  const suggestions = useMemo(() => {
    if (!mention) return [];
    return rankMentionSuggestions(state.files, state.folders, mention.q);
  }, [mention, state.files, state.folders]);

  const activeSuggestionIndex = Math.min(activeMentionIndex, Math.max(suggestions.length - 1, 0));

  useEffect(() => {
    activeMentionRef.current?.scrollIntoView({ block: 'nearest' });
  }, [activeSuggestionIndex]);

  const placeholder = phase === 'connecting'
    ? 'Connecting…'
    : phase === 'closed'
      ? 'Reconnect to continue…'
      : turnActive
        ? 'Ask for follow-up changes'
        : `Message ${agentShortName}…`;

  function pickMention(path: string) {
    if (!mention) return;
    composerRef.current?.insertMention(path, mention);
    setMention(null);
  }

  function submit(t: string) {
    const trimmed = t.trim();
    if ((!trimmed && attachments.length === 0) || disabled || uploading) return false;
    onSend(trimmed);
    setMention(null);
    return true;
  }

  function moveMention(direction: 1 | -1) {
    if (!suggestions.length) return;
    setActiveMentionIndex((index) => (index + direction + suggestions.length) % suggestions.length);
  }

  return (
    <div className="agent-composer">
      {mention && suggestions.length > 0 && (
        <div className="agent-mention">
          <div className="agent-mention-head">
            <span>Files and folders</span>
            <span>↑↓ navigate · Enter select · Esc dismiss</span>
          </div>
          <VisuallyHidden>
            <div role="status">
              {`${baseName(suggestions[activeSuggestionIndex].path)}, ${activeSuggestionIndex + 1} of ${suggestions.length}`}
            </div>
          </VisuallyHidden>
          <ListBox
            id={mentionListboxId}
            className="agent-mention-list"
            aria-label="Matching library files and folders"
            selectionMode="single"
            selectedKeys={[suggestions[activeSuggestionIndex].path]}
            onAction={(key) => pickMention(String(key))}
          >
            {suggestions.map((suggestion, index) => (
              <ListBoxItem
                key={suggestion.path}
                ref={index === activeSuggestionIndex ? activeMentionRef : null}
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
          </ListBox>
        </div>
      )}
      <div className="agent-composer-box">
        {(attachments.length > 0 || uploading) && (
          <div className="agent-attachments">
            {attachments.map((a) => (
              <span key={a.path} className="agent-attach-chip" title={a.path}>
                <FileGenericIcon className="agent-attach-icon" />
                <span className="agent-attach-text">
                  <span className="agent-attach-name">{a.name}</span>
                  <span className="agent-attach-path">{a.path}</span>
                </span>
                {a.dims && <span className="agent-attach-dims">{a.dims}</span>}
                <Button
                  className="agent-attach-x"
                  aria-label={`Remove ${a.name}`}
                  onPress={() => onRemoveAttachment(a.path)}
                >×</Button>
              </span>
            ))}
            {uploading && <span className="agent-attach-loading">Uploading…</span>}
          </div>
        )}
        <MentionComposer
          ref={composerRef}
          placeholder={placeholder}
          disabled={disabled}
          onChange={setText}
          onMentionChange={(next) => {
            setMention(next);
            setActiveMentionIndex(0);
          }}
          onMentionNavigate={moveMention}
          onMentionAccept={() => {
            if (!suggestions.length) return false;
            pickMention(suggestions[activeSuggestionIndex].path);
            return true;
          }}
          onMentionDismiss={() => setMention(null)}
          onShiftTab={() => {
            if (!showModeMenu || disabled) return false;
            cycleMode();
            return true;
          }}
          onSubmit={submit}
          mentionOpen={Boolean(mention && suggestions.length)}
          mentionListboxId={mention && suggestions.length ? mentionListboxId : undefined}
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
        <div className="agent-composer-bar">
          <Button
            className="agent-bar-btn"
            aria-label={uploading ? 'Uploading files' : 'Upload local files'}
            isDisabled={uploading}
            onPress={() => fileInputRef.current?.click()}
          >
            <PlusIcon />
          </Button>
          <span className="agent-bar-spacer" />
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
              onOpenChange={(open) => { setEffortOpen(open); if (open) setModeOpen(false); }}
              onSetEffort={(level) => { onSetEffort(level); setEffortOpen(false); }}
            />
          )}
          {turnActive ? (
            <Button className="agent-send stop" aria-label="Stop agent" onPress={onStop}>
              <StopIcon />
            </Button>
          ) : (
            <Button
              className="agent-send"
              aria-label="Send message"
              isDisabled={disabled || uploading || (!text.trim() && attachments.length === 0)}
              onPress={() => composerRef.current?.submit()}
            >
              <ArrowUpIcon />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
