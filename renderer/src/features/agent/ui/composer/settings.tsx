/** The composer's left-hand controls: which Agent runs the next turn, which
 *  model it uses, and how hard it thinks. Every control is disabled while a
 *  turn streams, because the runtime binds all three when the turn starts. */
import { BrainCircuit, ChevronDown, Cpu } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DropdownContent, DropdownMenu, DropdownTrigger } from '@/components/ui/dropdown';
import { MenuItem } from '@/components/ui/menu-item';
import type { Agent } from '@/features/agent/domain/agent-catalog';
import type { AgentSessionState } from '@/features/agent/domain/session';
import { AGENT_ICONS } from '@/features/agent/ui/identity/agent-icons';
import { cn } from '@/lib/utils';

/** Below this composer width the three controls keep their icons and drop
 *  their labels; the title attribute still names the selection. */
const NARROW_TRIGGER = '@max-[24rem]:px-1.5';
const NARROW_LABEL = '@max-[24rem]:hidden';

function effortLabel(effort: string): string {
  return effort
    .replace(/^xhigh$/u, 'Extra high')
    .replace(/[-_]+/gu, ' ')
    .replace(/^./u, (letter) => letter.toUpperCase());
}

function effortDescription(effort: string): string | undefined {
  switch (effort.toLowerCase()) {
    case 'low':
      return 'Faster';
    case 'medium':
      return 'Balanced';
    case 'high':
      return 'Deeper reasoning';
    case 'xhigh':
      return 'Deepest reasoning';
    case 'max':
      return 'Maximum reasoning';
    default:
      return undefined;
  }
}

export function AgentComposerSettings({
  activeAgent,
  agents,
  state,
  onAgentChange,
  onEffortChange,
  onModelChange,
  onRequestCatalog,
}: {
  activeAgent: Agent;
  agents: Agent[];
  state: Pick<AgentSessionState, 'activeModel' | 'effort' | 'model' | 'models' | 'transcript'> & {
    /** Whether a turn is streaming; model and effort are fixed for its run. */
    activeTurn: boolean;
  };
  onAgentChange(agent: Agent['id']): void;
  onEffortChange(effort: string | null): void;
  onModelChange(model: string | null): void;
  onRequestCatalog(): void;
}) {
  const ActiveAgentIcon = AGENT_ICONS[activeAgent.id];
  const selectedModel = state.models.find((model) => model.id === state.model);
  const effectiveModel =
    selectedModel ?? state.models.find((model) => model.id === state.activeModel);
  const effortOptions = effectiveModel?.supportedEfforts ?? [];
  const modelLocked =
    state.activeTurn || (activeAgent.id === 'claude' && state.transcript.length > 0);

  return (
    <>
      <DropdownMenu disabled={state.activeTurn}>
        <DropdownTrigger
          render={
            <Button
              aria-label={`Provider: ${activeAgent.label}`}
              className={NARROW_TRIGGER}
              disabled={state.activeTurn}
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

      {activeAgent.abilities.models && (
        <DropdownMenu disabled={modelLocked}>
          <DropdownTrigger
            render={
              <Button
                aria-label={`Model: ${selectedModel?.label ?? 'Default'}`}
                className={cn('max-w-40', NARROW_TRIGGER)}
                disabled={modelLocked}
                leadingIcon={Cpu}
                onClick={onRequestCatalog}
                size="compact"
                trailingIcon={ChevronDown}
                title={`Model: ${selectedModel?.label ?? 'Default'}`}
                variant="ghost"
              >
                <span className={cn('truncate', NARROW_LABEL)}>
                  {selectedModel?.label ?? 'Default'}
                </span>
              </Button>
            }
          />
          <DropdownContent
            align="start"
            className="w-80 max-w-[calc(100vw-1rem)]"
            selectionAppearance="none"
            side="top"
          >
            <MenuItem
              checked={state.model === null}
              layout="wrap"
              label="Default"
              onSelect={() => onModelChange(null)}
            />
            {state.models.map((model) => (
              <MenuItem
                checked={model.id === state.model}
                key={model.id}
                label={model.label}
                layout="wrap"
                onSelect={() => onModelChange(model.id)}
              />
            ))}
          </DropdownContent>
        </DropdownMenu>
      )}

      {activeAgent.abilities.effort && (
        <DropdownMenu disabled={state.activeTurn || effortOptions.length === 0}>
          <DropdownTrigger
            render={
              <Button
                aria-label={`Thinking: ${state.effort ? effortLabel(state.effort) : 'Default'}`}
                className={NARROW_TRIGGER}
                disabled={state.activeTurn || effortOptions.length === 0}
                leadingIcon={BrainCircuit}
                onClick={onRequestCatalog}
                size="compact"
                trailingIcon={ChevronDown}
                title={`Thinking: ${state.effort ? effortLabel(state.effort) : 'Default'}`}
                variant="ghost"
              >
                <span className={NARROW_LABEL}>
                  {state.effort ? effortLabel(state.effort) : 'Default'}
                </span>
              </Button>
            }
          />
          <DropdownContent align="start" className="w-60" selectionAppearance="none" side="top">
            <MenuItem
              checked={state.effort === null}
              label="Default"
              onSelect={() => onEffortChange(null)}
            />
            {effortOptions.map((effort) => {
              const description = effortDescription(effort);
              return (
                <MenuItem
                  checked={effort === state.effort}
                  {...(description === undefined ? {} : { description })}
                  layout="inline"
                  key={effort}
                  label={effortLabel(effort)}
                  onSelect={() => onEffortChange(effort)}
                />
              );
            })}
          </DropdownContent>
        </DropdownMenu>
      )}
    </>
  );
}
