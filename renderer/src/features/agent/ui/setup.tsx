import { Layers } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { AgentId } from '@/features/agent/domain/session';
import { cn } from '@/lib/utils';
import type { Agent } from '@/shared/agent-runtime';

export function AgentSetup({
  agents,
  error,
  loading,
  onOpenSettings,
  onPrepare,
  preparingAgentId,
}: {
  agents: Agent[];
  error: boolean;
  loading: boolean;
  onOpenSettings(): void;
  onPrepare(id: AgentId, action: 'bootstrap' | 'login'): void;
  preparingAgentId?: AgentId;
}) {
  return (
    <div
      className={cn(
        'flex h-full min-h-0 items-center justify-center bg-surface-2 p-8',
        'w-full',
      )}
    >
      <div className="max-w-md text-center">
        <Layers aria-hidden="true" className="mx-auto size-7 text-muted-foreground" />
        <h2 className="mt-3 text-title font-semibold text-foreground">Get an Agent ready</h2>
        <p className="mt-1 text-caption text-muted-foreground">
          Agent setup is explicit. Choose a runtime here or manage all runtimes in Settings.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {agents.map((agent) => {
            const needsLogin = agent.bootstrap?.failure?.code === 'authentication-required';
            return (
              <Button
                key={agent.id}
                loading={preparingAgentId === agent.id}
                onClick={() => onPrepare(agent.id, needsLogin ? 'login' : 'bootstrap')}
                size="compact"
                variant="secondary"
              >
                {needsLogin ? `Sign in to ${agent.label}` : `Set up ${agent.label}`}
              </Button>
            );
          })}
          <Button onClick={onOpenSettings} size="compact" variant="ghost">
            Agent settings
          </Button>
        </div>
        {loading && <p className="mt-3 text-caption text-muted-foreground">Checking runtimes…</p>}
        {error && (
          <p className="mt-3 text-caption text-destructive" role="alert">
            Agent runtime status is unavailable.
          </p>
        )}
      </div>
    </div>
  );
}
