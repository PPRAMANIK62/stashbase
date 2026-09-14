/** What stands between this window and a sendable conversation, said beneath
 *  the composer rather than in place of it. A reader may write the request
 *  first and set a runtime up second, so the gate never takes the draft off
 *  the screen to ask for setup. */
import { Button } from '@/components/ui/button';
import { runtimeGate, type Agent } from '@/features/agent/domain/agent-catalog';
import type { AgentId } from '@/features/agent/domain/session';
import { FailureLine } from '@/shared/ui/failure-notice';

export function AgentSetupNotice({
  checking,
  error,
  onOpenSettings,
  onPrepare,
  onSignIn,
  pending,
  preparingAgentId,
}: {
  /** The catalog has not answered yet, so nothing is offered: an unanswered
   *  catalog is not the same as nothing being ready. */
  checking: boolean;
  error: boolean;
  onOpenSettings(): void;
  onPrepare(id: AgentId, action: 'bootstrap' | 'login'): void;
  /** Opens where the StashBase account is signed in; the bundled runtime waits
   *  on the account rather than on a setup step. */
  onSignIn(): void;
  pending: readonly Agent[];
  preparingAgentId?: AgentId | undefined;
}) {
  return (
    <div className="mx-auto w-full max-w-[46rem] shrink-0 px-4 pb-3 max-sm:px-3">
      {checking ? (
        <p className="text-caption text-muted-foreground">Checking runtimes…</p>
      ) : (
        <>
          <p className="text-caption text-muted-foreground">
            <span className="text-foreground">No Agent is ready yet.</span> Set one up to send this.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {pending.map((agent) => (
              <Button
                key={agent.id}
                loading={preparingAgentId === agent.id}
                onClick={() => {
                  const gate = runtimeGate(agent);
                  if (gate === 'account') onSignIn();
                  else onPrepare(agent.id, gate === 'login' ? 'login' : 'bootstrap');
                }}
                size="compact"
                variant="secondary"
              >
                {runtimeGate(agent) === 'setup'
                  ? `Set up ${agent.label}`
                  : `Sign in to ${agent.label}`}
              </Button>
            ))}
            <Button onClick={onOpenSettings} size="compact" variant="ghost">
              Agent settings
            </Button>
          </div>
        </>
      )}
      {error && (
        <FailureLine className="mt-2" tone="capability">
          Agent runtime status is unavailable.
        </FailureLine>
      )}
    </div>
  );
}
