import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  ArrowUpIcon, BoltIcon, CheckIcon, ChevronDownIcon, ClipboardListIcon, CodeIcon, DumbbellIcon,
  FileGenericIcon, HandIcon, PlusIcon,
} from '../../icons';
import { useApp } from '../../store/AppContext';
import { baseName } from './attachments';
import { MentionComposer, type MentionComposerHandle, type MentionQuery } from './MentionComposer';
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
  mode, open, disabled, wrapRef, onToggle, onPick,
}: {
  mode: PermMode;
  open: boolean;
  disabled: boolean;
  wrapRef: React.RefObject<HTMLDivElement | null>;
  onToggle: () => void;
  onPick: (m: PermMode) => void;
}) {
  const active = MODES.find((m) => m.id === mode) ?? MODES[0];
  const ActiveIcon = active.Icon;
  return (
    <div className="agent-mode-wrap" ref={wrapRef}>
      {open && (
        <div className="agent-mode-menu" role="menu">
          <div className="agent-mode-menu-head">
            <span>Access</span>
          </div>
          {MODES.map((m) => {
            const Icon = m.Icon;
            return (
              <button
                key={m.id}
                type="button"
                role="menuitemradio"
                aria-checked={m.id === mode}
                className={'agent-mode-opt' + (m.id === mode ? ' active' : '')}
                onClick={() => onPick(m.id)}
              >
                <Icon className="agent-mode-opt-icon" />
                <span className="agent-mode-opt-text">
                  <span className="agent-mode-opt-title">{m.label}</span>
                  <span className="agent-mode-opt-desc">{m.desc}</span>
                </span>
                {m.id === mode && <CheckIcon className="agent-mode-opt-check" />}
              </button>
            );
          })}
        </div>
      )}
      <button
        type="button"
        className="agent-mode-btn"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Access level (⇧+Tab)"
        onClick={onToggle}
      >
        <ActiveIcon className="agent-mode-icon" />
        {active.label}
        <ChevronDownIcon className="agent-mode-chevron" />
      </button>
    </div>
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
      <div className="agent-effort-track" role="group" aria-label="Effort">
        {EFFORTS.map((lv, i) => (
          <button
            key={lv}
            type="button"
            className={
              'agent-effort-notch'
              + (i <= cur ? ' on' : '')
              + (lv === effort ? ' cur' : '')
              + (lv === 'max' ? ' max' : '')
            }
            aria-label={EFFORT_LABEL[lv]}
            aria-pressed={lv === effort}
            title={EFFORT_LABEL[lv]}
            onClick={() => onSet(lv)}
          />
        ))}
      </div>
    </div>
  );
}

function EffortMenu({
  effort, open, disabled, locked, wrapRef, onToggle, onSetEffort,
}: {
  effort: EffortLevel;
  open: boolean;
  disabled: boolean;
  locked: boolean;
  wrapRef: React.RefObject<HTMLDivElement | null>;
  onToggle: () => void;
  onSetEffort: (level: EffortLevel) => void;
}) {
  const unavailable = disabled || locked;
  return (
    <div className="agent-mode-wrap" ref={wrapRef}>
      {open && !unavailable && (
        <div className="agent-mode-menu effort-only" role="menu">
          <EffortBar effort={effort} onSet={onSetEffort} />
        </div>
      )}
      <button
        type="button"
        className={'agent-mode-btn agent-effort-btn' + (locked ? ' is-locked' : '')}
        disabled={disabled}
        aria-disabled={unavailable}
        aria-haspopup="menu"
        aria-expanded={open && !unavailable}
        title={locked ? 'Effort applies to new chats' : 'Effort'}
        onClick={() => {
          if (unavailable) return;
          onToggle();
        }}
      >
        <DumbbellIcon className="agent-mode-icon" />
        {EFFORT_LABEL[effort]}
        <ChevronDownIcon className="agent-mode-chevron" />
      </button>
    </div>
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
  const modeWrapRef = useRef<HTMLDivElement>(null);
  const effortWrapRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeMentionRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { if (active) composerRef.current?.focus(); }, [active]);

  useEffect(() => {
    if (!modeOpen) return;
    function onDown(e: MouseEvent) {
      if (!modeWrapRef.current?.contains(e.target as Node)) setModeOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [modeOpen]);

  useEffect(() => {
    if (!effortOpen) return;
    function onDown(e: MouseEvent) {
      if (!effortWrapRef.current?.contains(e.target as Node)) setEffortOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [effortOpen]);

  useEffect(() => {
    if (effortLocked) setEffortOpen(false);
  }, [effortLocked]);

  function cycleMode() {
    const i = MODES.findIndex((m) => m.id === mode);
    onSetMode(MODES[(i + 1) % MODES.length].id);
  }

  const suggestions = useMemo(() => {
    if (!mention) return [];
    const q = mention.q.toLowerCase();
    return state.files
      .filter((f) => f.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [mention, state.files]);

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
          <div id={mentionListboxId} className="agent-mention-list" role="listbox" aria-label="Matching library files">
            {suggestions.map((f, index) => (
              <button
                key={f.name}
                ref={index === activeSuggestionIndex ? activeMentionRef : null}
                id={`${mentionListboxId}-option-${index}`}
                type="button"
                role="option"
                aria-selected={index === activeSuggestionIndex}
                tabIndex={-1}
                className={'agent-mention-item' + (index === activeSuggestionIndex ? ' active' : '')}
                onMouseEnter={() => setActiveMentionIndex(index)}
                onClick={() => pickMention(f.name)}
              >
                <FileGenericIcon className="agent-mention-icon" />
                <span className="agent-mention-text">
                  <span className="agent-mention-name">{baseName(f.name)}</span>
                  <span className="agent-mention-path">{f.name}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="agent-composer-box">
        {(attachments.length > 0 || uploading) && (
          <div className="agent-attachments">
            {attachments.map((a) => (
              <span key={a.path} className="agent-attach-chip" title={a.path}>
                <FileGenericIcon className="agent-attach-icon" />
                <span className="agent-attach-name">{a.name}</span>
                {a.dims && <span className="agent-attach-dims">{a.dims}</span>}
                <button
                  type="button"
                  className="agent-attach-x"
                  title="Remove attachment"
                  onClick={() => onRemoveAttachment(a.path)}
                >×</button>
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
            pickMention(suggestions[activeSuggestionIndex].name);
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
          activeMentionOptionId={mention && suggestions.length ? `${mentionListboxId}-option-${activeSuggestionIndex}` : undefined}
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
          <button
            type="button"
            className="agent-bar-btn"
            title={uploading ? 'Uploading…' : 'Upload local files'}
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            <PlusIcon />
          </button>
          <span className="agent-bar-spacer" />
          {showModeMenu && (
            <AccessMenu
              mode={mode}
              open={modeOpen}
              disabled={disabled}
              wrapRef={modeWrapRef}
              onToggle={() => { setModeOpen((o) => !o); setEffortOpen(false); }}
              onPick={(m) => { onSetMode(m); setModeOpen(false); }}
            />
          )}
          {showEffortMenu && (
            <EffortMenu
              effort={effort}
              open={effortOpen}
              disabled={disabled}
              locked={effortLocked}
              wrapRef={effortWrapRef}
              onToggle={() => {
                if (effortLocked) return;
                setEffortOpen((o) => !o);
                setModeOpen(false);
              }}
              onSetEffort={(level) => { onSetEffort(level); setEffortOpen(false); }}
            />
          )}
          {turnActive ? (
            <button type="button" className="agent-send stop" title="Stop" onClick={onStop}>■</button>
          ) : (
            <button
              type="button"
              className="agent-send"
              title="Send"
              disabled={disabled || uploading || (!text.trim() && attachments.length === 0)}
              onClick={() => composerRef.current?.submit()}
            >
              <ArrowUpIcon />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
