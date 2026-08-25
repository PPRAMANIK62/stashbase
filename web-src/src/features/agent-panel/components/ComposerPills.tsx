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
  Menu, MenuPopup, MenuPortal, MenuPositioner, MenuTrigger,
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
import { modelMenuLabel, type ModelMenuLockReason } from '@/features/agent-panel/lib/modelState';

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

/** Thinking-effort control behind its own pill. */
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
  /** Explicit user intent; null means native Default. */
  selected?: string | null;
  /** Model the runtime says the live session is actually using. */
  active?: string;
  models: AgentModel[];
  locked: boolean;
  lockReason: ModelMenuLockReason;
  notice: string | null;
  resumedSession: boolean;
  onSet: (model?: string) => void;
}

/** Model pill — stays visible on the bar. Its runtime-specific lock reason
 * distinguishes a temporarily active turn from a fixed conversation. */
export function ModelMenu({ model, disabled }: { model: ComposerModelControl; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const label = modelMenuLabel(model.models, model.selected, model.active, model.resumedSession);
  const lockDescription = model.lockReason;
  return (
    <Menu open={open} onOpenChange={setOpen}>
      <MenuTrigger
        render={<Pill locked={model.locked} className="max-w-40" />}
        disabled={disabled || model.locked}
        aria-label={`Model: ${label}${lockDescription ? ` — ${lockDescription}` : ''}`}
        title={lockDescription ? `Model — ${label} (${lockDescription})` : `Model — ${label}`}
      >
        {label === 'Default' ? 'Model: Default' : label}
      </MenuTrigger>
      <MenuPortal>
        <MenuPositioner side="top" align="end" sideOffset={6}>
          <MenuPopup className={cn(menuPopupClass, 'max-h-overlay-sm')}>
            {/* A radio group, not a stack of buttons: each row becomes a
              * `menuitemradio` carrying its own checked state, and the
              * check glyph comes from the primitive rather than being
              * drawn per row.
              *
              * The heading lives INSIDE the group: `MenuGroupLabel` reads
              * the group's context to register itself as the group's
              * accessible name, and throws outright when rendered without
              * one — a sibling heading above the group took the whole
              * chat pane to its error boundary the moment a pill opened. */}
            <MenuRadioGroup
              value={model.selected ?? DEFAULT_VALUE}
              onValueChange={(value) => {
                model.onSet(value === DEFAULT_VALUE ? undefined : String(value));
                setOpen(false);
              }}
            >
              <MenuGroupLabel>Model</MenuGroupLabel>
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

/** Mode pill — the permission-mode list, and nothing else.
 *
 * Mode and effort are independent session settings, so they are two pills
 * with two menus. Stacking effort under the mode list in one popup made a
 * panel tall enough to scroll, put two headings in one card so it read as
 * two menus anyway, and left the trigger trying to name both at once
 * ("Ask · High") — a label that grew a second value the moment either
 * setting moved off its default. */
export function ModeMenu({ mode, disabled }: {
  mode: ComposerModeControl;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const activeMode = MODES.find((m) => m.id === mode.value) ?? MODES[0];
  return (
    <Menu open={open} onOpenChange={setOpen}>
      <MenuTrigger
        render={<Pill className="max-w-40" />}
        disabled={disabled}
        aria-label={`Permission mode: ${activeMode.label} — ${activeMode.desc}`}
        title={`Permission mode — ${activeMode.label}`}
      >
        {activeMode.label}
      </MenuTrigger>
      <MenuPortal>
        <MenuPositioner side="top" align="end" sideOffset={6}>
          <MenuPopup className={menuPopupClass}>
            <MenuRadioGroup
              value={mode.value}
              onValueChange={(value) => { mode.onSet(value as PermMode); setOpen(false); }}
            >
              <MenuGroupLabel>Mode</MenuGroupLabel>
              {MODES.map((m) => (
                <MenuRadioItem key={m.id} value={m.id}>
                  <MenuOptionContent icon={m.Icon} title={m.label} description={m.desc} />
                </MenuRadioItem>
              ))}
            </MenuRadioGroup>
          </MenuPopup>
        </MenuPositioner>
      </MenuPortal>
    </Menu>
  );
}

/** Effort pill — reasoning effort as a vertical list, the same row idiom
 * as the Mode and Model pills beside it. The Default row (clears any
 * override) leads, then each level the runtime advertises, in its own
 * order. Being data-driven rows, it renders any agent's set — Claude's
 * Low…Max, Codex's Light…Ultra — with no wrapping or layout risk.
 *
 * Locked works the way the Model pill's does: the trigger itself goes
 * inert and says why, rather than the popup opening onto a dimmed list. */
export function EffortMenu({ effort, disabled }: {
  effort: ComposerEffortControl;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const efforts = effortOptions(effort.supported);
  const name = effort.level ? effortLabel(effort.level) : effort.inherited ? 'Inherited' : 'Default';
  return (
    <Menu open={open} onOpenChange={setOpen}>
      <MenuTrigger
        render={<Pill locked={effort.locked} className="max-w-40" />}
        disabled={disabled || effort.locked}
        aria-label={`Reasoning effort: ${name}${effort.locked ? ' — fixed for this conversation' : ''}`}
        title={effort.locked ? `Effort — ${name} (fixed for this session)` : `Effort — ${name}`}
      >
        {name === 'Default' ? 'Effort: Default' : name}
      </MenuTrigger>
      <MenuPortal>
        <MenuPositioner side="top" align="end" sideOffset={6}>
          <MenuPopup className={menuPopupClass}>
            <MenuRadioGroup
              value={effort.level ?? DEFAULT_VALUE}
              onValueChange={(value) => {
                effort.onSet(value === DEFAULT_VALUE ? undefined : (value as EffortLevel));
                setOpen(false);
              }}
            >
              <MenuGroupLabel>Effort</MenuGroupLabel>
              <MenuRadioItem value={DEFAULT_VALUE} className="text-sm">
                <span className={cn('min-w-0 truncate', !effort.level && 'font-medium')}>
                  Default
                  {/* The session inherited a non-default effort from a resumed
                    * transcript; the Default row is where you'd clear it, so it's
                    * where the current inherited state reads. */}
                  {effort.inherited && !effort.level && (
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">inherited</span>
                  )}
                </span>
              </MenuRadioItem>
              {efforts.map((level) => (
                <MenuRadioItem key={level} value={level} className="text-sm">
                  <span className={cn('min-w-0 truncate', effort.level === level && 'font-medium')}>
                    {effortLabel(level)}
                  </span>
                </MenuRadioItem>
              ))}
            </MenuRadioGroup>
          </MenuPopup>
        </MenuPositioner>
      </MenuPortal>
    </Menu>
  );
}
