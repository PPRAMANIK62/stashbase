/** The composer's provider control: which Agent runs the next turn. It goes
 *  inert while a turn streams, because the runtime binds it when the turn
 *  starts, and picking another Agent starts a new Chat rather than repointing
 *  this one, which is the caller's to arrange.
 *
 *  The list is the whole catalog, not the runtimes that happen to be ready. A
 *  runtime nobody has prepared is the one a reader most needs to see named:
 *  the bundled Agent is invisible to a signed-out reader with another runtime
 *  installed, and there is nowhere else in the composer it is offered. A row
 *  that cannot carry a turn says what it is waiting for and starts exactly
 *  that when it is picked, rather than repointing the Chat at a runtime that
 *  would refuse the turn. */
import { ChevronDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DropdownContent, DropdownMenu, DropdownTrigger } from '@/components/ui/dropdown';
import { MenuItem } from '@/components/ui/menu-item';
import { runtimeGate, type Agent } from '@/features/agent/domain/agent-catalog';
import type { AgentId } from '@/features/agent/domain/session';
import { AGENT_ICONS } from '@/shared/brand/agent-icons';

import { NARROW_LABEL, NARROW_TRIGGER } from './narrow';

export function AgentProviderControl({
  activeAgent,
  agents,
  disabled,
  onAgentChange,
  onPrepare,
  onSignIn,
}: {
  activeAgent: Agent;
  /** The whole catalog, ready or not. */
  agents: Agent[];
  /** Whether a turn is streaming; the provider is fixed for its run. */
  disabled: boolean;
  onAgentChange(agent: Agent['id']): void;
  /** Starts what a runtime is waiting for, which is the only thing picking an
   *  unprepared row can honestly mean. */
  onPrepare(agent: AgentId, action: 'bootstrap' | 'login'): void;
  /** Opens where the StashBase account is signed in. The bundled runtime waits
   *  on the account, which `onPrepare` cannot start. */
  onSignIn(): void;
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
        {agents.map((agent) =>
          agent.ready ? (
            <MenuItem
              checked={agent.id === activeAgent.id}
              icon={AGENT_ICONS[agent.id]}
              key={agent.id}
              label={agent.label}
              onSelect={() => onAgentChange(agent.id)}
            />
          ) : (
            // No check, because nothing here is being chosen: the row is an
            // offer to clear whatever stands in the runtime's way, and it
            // carries that beside the name so the picking is not a guess.
            <MenuItem
              description={runtimeGate(agent) === 'setup' ? 'Set up' : 'Sign in'}
              icon={AGENT_ICONS[agent.id]}
              key={agent.id}
              label={agent.label}
              layout="inline"
              onSelect={() => {
                const gate = runtimeGate(agent);
                if (gate === 'account') onSignIn();
                else onPrepare(agent.id, gate === 'login' ? 'login' : 'bootstrap');
              }}
            />
          ),
        )}
      </DropdownContent>
    </DropdownMenu>
  );
}
