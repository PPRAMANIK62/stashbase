/**
 * The composer bar's session pills — model, permission mode, and reasoning
 * effort — plus the popovers behind them.
 *
 * Each is a pure function of the control object AgentComposer hands it: no
 * draft text, no attachments, no mention state, nothing else in the
 * composer. They live here so `AgentComposer.tsx` is the input surface and
 * its send path, not also three menus.
 *
 * Composer-bar pills are the shared `Pill` trigger with a control-naming
 * title/aria-label, so adjacent "Default" values stay distinguishable. The
 * session settings live behind a single trigger, so no pill needs
 * emphasis.
 */
import { useState } from 'react';
import {
  Menu, MenuPopup, MenuPortal, MenuPositioner, MenuSeparator, MenuTrigger,
} from '@/common/components/ui/menu';
import {
  MenuGroupLabel, MenuRadioGroup, MenuRadioItem,
} from '@/common/components/ui/menu-radio';
import {
  BoltIcon, ClipboardListIcon, CodeIcon, HandIcon,
} from '@/common/components/icons';
import { MenuOptionContent } from '@/common/components/ui/menu-option';
import { Pill } from '@/common/components/ui/pill';
import { cn } from '@/common/lib/utils';
import { effortLabel, effortOptions } from '@/features/agent-panel/lib/effortMenuState';
import type { AgentModel, EffortLevel, PermMode } from '@/features/agent-panel/lib/types';
import { modelMenuLabel } from '@/features/agent-panel/lib/modelState';

const MODES: { id: PermMode; label: string; desc: string; Icon: typeof HandIcon }[] = [
  { id: 'default', label: 'Ask', desc: 'Ask before edits or higher-risk actions', Icon: HandIcon },
  { id: 'acceptEdits', label: 'Edit', desc: 'Apply file edits without asking each time', Icon: CodeIcon },
  { id: 'plan', label: 'Plan', desc: 'Explore and propose a plan before changing files', Icon: ClipboardListIcon },
  { id: 'auto', label: 'Auto', desc: 'Let the agent decide when approval is needed', Icon: BoltIcon },
];

/** The next mode in the bar's cycle order, for the composer's Shift-Tab
 *  shortcut. An unrecognized current mode restarts the cycle. */
export function nextPermMode(current: PermMode): PermMode {
  const index = MODES.findIndex((m) => m.id === current);
  return MODES[(index + 1) % MODES.length].id;
}

/* Upward menus anchored to the pills. The surface itself (card, border,
 * radius, shadow, entry motion) comes from MenuPopup; only the sizing is
 * local, so a tall panel (Mode plus a long effort list) scrolls INSIDE the
 * card instead of spilling rows past its clipped background. */
const menuPopupClass =
  'max-h-overlay-lg w-80 max-w-overlay-fit overflow-y-auto overscroll-contain p-1.5 scrollbar-quiet';

/* The radio value standing in for "no override". A radio group needs a
 * value for every row, and `undefined` is the absence of one. */
const DEFAULT_VALUE = '__default__';

/** Permission-mode control for the composer bar's Mode pill. */
export interface ComposerModeControl {
  show: boolean;
  value: PermMode;
  onSet: (mode: PermMode) => void;
}

/** Thinking-effort control, sharing the Mode pill's popover. */
export interface ComposerEffortControl {
  show: boolean;
  /** Explicit override; undefined preserves the runtime default. */
  level?: EffortLevel;
  /** The resumed session carries a non-default effort the user never
   * picked here (reads on the Default row). */
  inherited: boolean;
  locked: boolean;
  /** Effort ids the effective model supports; undefined means all. */
  supported?: string[];
  onSet: (level?: EffortLevel) => void;
}

/** Model control for the bar's Model pill. */
export interface ComposerModelControl {
  show: boolean;
  /** User intent for the next session; undefined means Default (no override). */
  selected?: string;
  /** Model the runtime says the live session is actually using. */
  active?: string;
  models: AgentModel[];
  locked: boolean;
  notice: string | null;
  resumedSession: boolean;
  onSet: (model?: string) => void;
}

/** Model pill — stays its own control so the current model is always
 * visible on the bar. Locked once the session has content. */
export function ModelMenu({ model, disabled }: { model: ComposerModelControl; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const label = modelMenuLabel(model.models, model.selected, model.active, model.resumedSession);
  return (
    <Menu open={open} onOpenChange={setOpen}>
      <MenuTrigger
        render={<Pill locked={model.locked} className="max-w-40" />}
        disabled={disabled || model.locked}
        aria-label={`Model: ${label}${model.locked ? ' — fixed for this conversation' : ''}`}
        title={model.locked ? `Model — ${label} (fixed for this conversation)` : `Model — ${label}`}
      >
        {label === 'Default' ? 'Model: Default' : label}
      </MenuTrigger>
      <MenuPortal>
        <MenuPositioner side="top" align="end" sideOffset={6}>
          <MenuPopup className={cn(menuPopupClass, 'max-h-overlay-sm')}>
            <MenuGroupLabel>Model</MenuGroupLabel>
            {/* A radio group, not a stack of buttons: each row becomes a
              * `menuitemradio` carrying its own checked state, and the
              * check glyph comes from the primitive rather than being
              * drawn per row. */}
            <MenuRadioGroup
              value={model.selected ?? DEFAULT_VALUE}
              onValueChange={(value) => {
                model.onSet(value === DEFAULT_VALUE ? undefined : String(value));
                setOpen(false);
              }}
            >
              <MenuRadioItem value={DEFAULT_VALUE}>
                <MenuOptionContent title="Default" description="Use this runtime’s configured model" />
              </MenuRadioItem>
              {model.models.map((entry) => (
                <MenuRadioItem key={entry.id} value={entry.id}>
                  <MenuOptionContent title={entry.label} description={entry.description} />
                </MenuRadioItem>
              ))}
            </MenuRadioGroup>
          </MenuPopup>
        </MenuPositioner>
      </MenuPortal>
    </Menu>
  );
}

/** Mode pill — the permission-mode list with the effort bar at the bottom
 * of the same panel (the Claude Code treatment): mode stays visible on the
 * bar, effort lives one click away and echoes on the trigger only when
 * non-default ("Ask · High"). If the runtime has no mode control the pill
 * degrades to an effort-only trigger. */
export function ModeMenu({ mode, effort, disabled }: {
  mode: ComposerModeControl;
  effort: ComposerEffortControl;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const activeMode = MODES.find((m) => m.id === mode.value) ?? MODES[0];
  const efforts = effortOptions(effort.supported);
  const effortName = effort.level ? effortLabel(effort.level) : effort.inherited ? 'Inherited' : 'Default';
  const effortSuffix = effort.show && (effort.level || effort.inherited) ? ` · ${effortName}` : '';
  const label = mode.show
    ? `${activeMode.label}${effortSuffix}`
    : `Effort: ${effortName}`;
  return (
    <Menu open={open} onOpenChange={setOpen}>
      <MenuTrigger
        render={<Pill />}
        disabled={disabled}
        aria-label={mode.show
          ? `Permission mode: ${activeMode.label} — ${activeMode.desc}${effort.show && effort.level ? `; reasoning effort ${effortLabel(effort.level)}` : ''}`
          : `Reasoning effort: ${effortName}`}
      >
        {label}
      </MenuTrigger>
      <MenuPortal>
        <MenuPositioner side="top" align="end" sideOffset={6}>
          <MenuPopup className={menuPopupClass}>
            {mode.show && (
              <>
                <MenuGroupLabel>Mode</MenuGroupLabel>
                <MenuRadioGroup
                  value={mode.value}
                  onValueChange={(value) => { mode.onSet(value as PermMode); setOpen(false); }}
                >
                  {MODES.map((m) => (
                    <MenuRadioItem key={m.id} value={m.id}>
                      <MenuOptionContent icon={m.Icon} title={m.label} description={m.desc} />
                    </MenuRadioItem>
                  ))}
                </MenuRadioGroup>
              </>
            )}
            {effort.show && (
              <>
                {mode.show && <MenuSeparator />}
                <div
                  className={effort.locked ? 'pointer-events-none opacity-60' : undefined}
                  title={effort.locked ? 'Effort is fixed for this session' : undefined}
                >
                  <EffortList effort={effort.level} efforts={efforts} inherited={effort.inherited} onSet={effort.onSet} />
                </div>
              </>
            )}
          </MenuPopup>
        </MenuPositioner>
      </MenuPortal>
    </Menu>
  );
}

/** Effort as a vertical list — the same row idiom as the Mode and Model
 * lists above it, so the whole popover reads as one control. The Default
 * row (clears any override) leads, then each level the runtime advertises,
 * in its own order. Being data-driven rows, it renders any agent's set —
 * Claude's Low…Max, Codex's Light…Ultra — with no wrapping or layout risk. */
function EffortList({ effort, efforts, inherited, onSet }: { effort?: EffortLevel; efforts: EffortLevel[]; inherited: boolean; onSet: (l?: EffortLevel) => void }) {
  return (
    <>
      <MenuGroupLabel>Effort</MenuGroupLabel>
      <MenuRadioGroup
        value={effort ?? DEFAULT_VALUE}
        onValueChange={(value) => onSet(value === DEFAULT_VALUE ? undefined : (value as EffortLevel))}
      >
        <MenuRadioItem value={DEFAULT_VALUE} className="text-sm">
          <span className={cn('min-w-0 truncate', !effort && 'font-medium')}>
            Default
            {/* The session inherited a non-default effort from a resumed
              * transcript; the Default row is where you'd clear it, so it's
              * where the current inherited state reads. */}
            {inherited && !effort && (
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">inherited</span>
            )}
          </span>
        </MenuRadioItem>
        {efforts.map((level) => (
          <MenuRadioItem key={level} value={level} className="text-sm">
            <span className={cn('min-w-0 truncate', effort === level && 'font-medium')}>
              {effortLabel(level)}
            </span>
          </MenuRadioItem>
        ))}
      </MenuRadioGroup>
    </>
  );
}
