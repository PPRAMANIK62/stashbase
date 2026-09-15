/** Selecting an Agent records project preference; access is requested on Send. */
import { ChevronDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DropdownContent, DropdownMenu, DropdownTrigger } from '@/components/ui/dropdown';
import { MenuItem } from '@/components/ui/menu-item';
import { Tooltip } from '@/components/ui/tooltip';
import { type Agent } from '@/features/agent/domain/agent-catalog';
import { AGENT_ICONS } from '@/shared/brand/agent-icons';

import { NARROW_LABEL, NARROW_TRIGGER } from './narrow';

export function AgentProviderControl({
  activeAgent,
  startsNewChat = false,
  agents,
  disabled,
  onAgentChange,
}: {
  activeAgent: Agent;
  startsNewChat?: boolean;
  /** The whole catalog, ready or not. */
  agents: Agent[];
  /** Whether a turn is streaming; the provider is fixed for its run. */
  disabled: boolean;
  onAgentChange(agent: Agent['id']): void;
}) {
  const ActiveAgentIcon = AGENT_ICONS[activeAgent.id];

  return (
    <DropdownMenu disabled={disabled}>
      <Tooltip content={`Provider: ${activeAgent.label}`} side="top">
        <DropdownTrigger
          render={
            <Button
              aria-label={`Provider: ${activeAgent.label}`}
              className={NARROW_TRIGGER}
              disabled={disabled}
              leadingIcon={ActiveAgentIcon}
              size="compact"
              trailingIcon={ChevronDown}
              variant="ghost"
            >
              <span className={NARROW_LABEL}>{activeAgent.label}</span>
            </Button>
          }
        />
      </Tooltip>
      <DropdownContent align="start" className="w-52" selectionAppearance="none" side="top">
        {agents.map((agent) => (
          <MenuItem
            checked={agent.id === activeAgent.id}
            {...(startsNewChat && agent.id !== activeAgent.id
              ? { description: 'Start a new chat' }
              : {})}
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
