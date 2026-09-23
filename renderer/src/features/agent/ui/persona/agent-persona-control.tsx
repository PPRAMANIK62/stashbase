/**
 * The composer's persona picker: who the Agent is when it talks and writes in
 * this project.
 *
 * The packaged personas are there so a reader never faces an empty box to get
 * started; Custom opens one for the reader's own. A pick keeps the menu open,
 * the way every choice menu in the composer does, so the check can be seen to
 * move and a refused save can be read where it was made.
 */
import {
  BookOpen,
  ChevronDown,
  CircleDashed,
  Drama,
  Megaphone,
  Newspaper,
  PenLine,
} from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  DropdownContent,
  DropdownMenu,
  DropdownSeparator,
  DropdownTrigger,
} from '@/components/ui/dropdown';
import { MenuItem } from '@/components/ui/menu-item';
import { Tooltip } from '@/components/ui/tooltip';
import type { AgentPersonaChoice } from '@/features/agent/application/ports';
import type { AgentPersonaPicker } from '@/features/agent/hooks/use-agent-persona';
import { NARROW_LABEL, NARROW_TRIGGER } from '@/features/agent/ui/composer/narrow';
import type { IconComponent } from '@/lib/icon-context';
import { cn } from '@/lib/utils';
import { FailureNotice } from '@/shared/ui/failure-notice';

import { AgentPersonaDialog } from './agent-persona-dialog';

type PackagedPersona = Exclude<AgentPersonaChoice, 'custom'>;

interface PersonaCopy {
  description: string;
  icon: IconComponent;
  label: string;
}

/** The packaged personas in the order the picker lists them. Their prompts
 *  are packaged server-side; this is only what the reader sees. */
const PACKAGED_ORDER: readonly PackagedPersona[] = ['marketer', 'journalist', 'storyteller'];

const COPY: Record<AgentPersonaChoice, PersonaCopy> = {
  custom: { description: 'Your own persona prompt', icon: PenLine, label: 'Custom' },
  journalist: { description: 'A neutral news report', icon: Newspaper, label: 'Journalist' },
  marketer: { description: 'Upbeat launch copy', icon: Megaphone, label: 'Marketer' },
  storyteller: { description: 'Scene first, point later', icon: BookOpen, label: 'Storyteller' },
};

export interface AgentPersonaControlProps {
  /** A turn is running; a session's persona is fixed for its run. */
  disabled: boolean;
  picker: AgentPersonaPicker;
  scopeName: string;
}

export function AgentPersonaControl({ disabled, picker, scopeName }: AgentPersonaControlProps) {
  const [editing, setEditing] = useState(false);
  const [openings, setOpenings] = useState(0);
  const chosen = picker.selected === null ? null : COPY[picker.selected];
  const label = chosen ? `Persona: ${chosen.label}` : 'Persona';
  const locked = disabled || picker.loading || picker.saving;

  return (
    <>
      <DropdownMenu
        disabled={locked}
        onOpenChange={(open) => {
          if (open) picker.dismissFailure();
        }}
      >
        <Tooltip content={label} side="top">
          <DropdownTrigger
            render={
              <Button
                aria-label={label}
                className={cn('max-w-44', NARROW_TRIGGER)}
                disabled={locked}
                leadingIcon={chosen?.icon ?? Drama}
                size="compact"
                trailingIcon={ChevronDown}
                variant="ghost"
              >
                <span className={cn('min-w-0 truncate', NARROW_LABEL)}>
                  {chosen?.label ?? 'Persona'}
                </span>
              </Button>
            }
          />
        </Tooltip>
        <DropdownContent
          align="start"
          className="w-72 max-w-[calc(100vw-1rem)]"
          selectionAppearance="none"
          side="top"
        >
          <MenuItem
            checked={picker.selected === null}
            closeOnClick={false}
            description="The Agent’s own voice"
            icon={CircleDashed}
            label="None"
            onSelect={() => picker.choose(null)}
          />
          {PACKAGED_ORDER.map((id) => (
            <MenuItem
              checked={picker.selected === id}
              closeOnClick={false}
              description={COPY[id].description}
              icon={COPY[id].icon}
              key={id}
              label={COPY[id].label}
              onSelect={() => picker.choose(id)}
            />
          ))}
          <DropdownSeparator />
          <MenuItem
            checked={picker.selected === 'custom'}
            description={COPY.custom.description}
            icon={COPY.custom.icon}
            label={COPY.custom.label}
            onSelect={() => {
              picker.dismissFailure();
              setOpenings((count) => count + 1);
              setEditing(true);
            }}
          />
          {picker.failure && !editing && <FailureNotice className="m-1" failure={picker.failure} />}
        </DropdownContent>
      </DropdownMenu>
      <AgentPersonaDialog
        key={openings}
        onClose={() => setEditing(false)}
        open={editing}
        picker={picker}
        scopeName={scopeName}
      />
    </>
  );
}
