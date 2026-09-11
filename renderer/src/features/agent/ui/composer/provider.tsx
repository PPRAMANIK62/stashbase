/** The composer's provider control: which Agent runs the next turn. It goes
 *  inert while a turn streams, because the runtime binds it when the turn
 *  starts, and picking another Agent starts a new Chat rather than repointing
 *  this one, which is the caller's to arrange. */
import { ChevronDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DropdownContent, DropdownMenu, DropdownTrigger } from '@/components/ui/dropdown';
import { MenuItem } from '@/components/ui/menu-item';
import type { Agent } from '@/features/agent/domain/agent-catalog';
import { AGENT_ICONS } from '@/features/agent/ui/identity/agent-icons';

import { NARROW_LABEL, NARROW_TRIGGER } from './narrow';

export function AgentProviderControl({
  activeAgent,
  agents,
  disabled,
  onAgentChange,
}: {
  activeAgent: Agent;
  agents: Agent[];
  /** Whether a turn is streaming; the provider is fixed for its run. */
  disabled: boolean;
  onAgentChange(agent: Agent['id']): void;
}) {
  const ActiveAgentIcon = AGENT_ICONS[activeAgent.id];

  return (
    <DropdownMenu disabled={disabled}>
      <DropdownTrigger
        render={
          <Button
            aria-label={`Provider: ${activeAgent.label}`}
            className={NARROW_TRIGGER}
            disabled={disabled}
            leadingIcon={ActiveAgentIcon}
            size="compact"
            trailingIcon={ChevronDown}
            title={`Provider: ${activeAgent.label}`}
            variant="ghost"
          >
            <span className={NARROW_LABEL}>{activeAgent.label}</span>
          </Button>
        }
      />
      <DropdownContent align="start" className="w-52" selectionAppearance="none" side="top">
        {agents.map((agent) => (
          <MenuItem
            checked={agent.id === activeAgent.id}
            icon={AGENT_ICONS[agent.id]}
            key={agent.id}
            label={agent.label}
            onSelect={() => onAgentChange(agent.id)}
          />
        ))}
      </DropdownContent>
    </DropdownMenu>
  );
}
