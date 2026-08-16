import { Button } from 'react-aria-components';
import { buttonVariants } from '@/common/components/ui/button';
import { runtimeFailurePresentation } from '@/features/agent-panel/lib/runtimeFailurePresentation';
import type { Agent } from '@/common/api/api';

const runtimeCardWrapClass = 'grid min-h-45 flex-1 place-items-center px-3 py-6';
/* One text rhythm with the app's dialogs (ManagedModalShell): body-size
 * medium title, body-size muted copy at mt-2. Card surface is bg-card —
 * chat is canvas, its cards float on the card role. */
const runtimeCardClass = 'w-[min(440px,100%)] rounded-xl border border-border bg-card p-4 text-foreground';
const runtimeCardTitleClass = 'm-0 text-base font-medium leading-snug';
const runtimeCardCopyClass = 'mt-2 mb-3 text-base leading-normal text-muted-foreground';
const runtimeCardActionsClass = 'mt-3 flex justify-end gap-2';

function AgentRuntimeSetup({
  runtime,
  fallbackName,
  onInstall,
  onRefresh,
}: {
  runtime: Agent | undefined;
  fallbackName: string;
  onInstall: () => void;
  onRefresh: () => void;
}) {
  const name = runtime?.label ?? fallbackName;
  return (
    <div className={runtimeCardWrapClass} role="status">
      <div className={runtimeCardClass}>
        <h2 className={runtimeCardTitleClass}>{name} is not installed</h2>
        {/* First-run install keeps ONE primary path: no manual-command
          * escape hatch and no PATH/implementation caveats here — that
          * recovery detail lives on the failure card, where an install
          * has actually gone wrong. */}
        <p className={runtimeCardCopyClass}>StashBase can set up the official runtime for you.</p>
        <div className={runtimeCardActionsClass}>
          <Button className={buttonVariants({ variant: 'outline', size: 'sm' })} onPress={onRefresh}>Check again</Button>
          <Button className={buttonVariants({ variant: 'default', size: 'sm' })} onPress={onInstall}>Install and continue</Button>
        </div>
      </div>
    </div>
  );
}

function AgentRuntimeProgress({ runtime, fallbackName }: { runtime: Agent; fallbackName: string }) {
  const status = runtime.bootstrap;
  const name = runtime.label || fallbackName;
  const progress = typeof status?.progress === 'number' ? Math.max(0, Math.min(1, status.progress)) : null;
  return (
    <div className={runtimeCardWrapClass} role="status" aria-live="polite">
      <div className={runtimeCardClass}>
        <h2 className={runtimeCardTitleClass}>Preparing {name}</h2>
        <p className={runtimeCardCopyClass}>{status?.message ?? `Installing ${name}…`}</p>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={'h-full rounded-full bg-accent transition-[width] duration-standard ' + (progress == null ? 'w-1/3 animate-pulse' : '')}
            style={progress == null ? undefined : { width: `${Math.round(progress * 100)}%` }}
          />
        </div>
        <p className="mt-2 mb-0 text-xs text-muted-foreground">You can keep browsing while this finishes.</p>
      </div>
    </div>
  );
}

function AgentRuntimeFailure({
  runtime,
  fallbackName,
  onRetry,
  onCopyInstall,
  onOpenMcpSetup,
}: {
  runtime: Agent;
  fallbackName: string;
  onRetry: () => void;
  onCopyInstall: () => void;
  onOpenMcpSetup: () => void;
}) {
  const name = runtime.label || fallbackName;
  const presentation = runtimeFailurePresentation(runtime.bootstrap, name);
  const manualAction = presentation.manualAction === 'copy-install-command'
    ? onCopyInstall
    : presentation.manualAction === 'open-mcp-settings'
      ? onOpenMcpSetup
      : null;
  return (
    <div className={runtimeCardWrapClass} role="alert">
      <div className={runtimeCardClass}>
        <h2 className={runtimeCardTitleClass}>{presentation.title}</h2>
        <p className={runtimeCardCopyClass}>{presentation.message}</p>
        <div className={runtimeCardActionsClass}>
          {manualAction && presentation.manualLabel && (
            <Button className={buttonVariants({ variant: 'outline', size: 'sm' })} onPress={manualAction}>
              {presentation.manualLabel}
            </Button>
          )}
          <Button className={buttonVariants({ variant: 'default', size: 'sm' })} onPress={onRetry}>
            {presentation.retryLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

function AgentRuntimeChecking({ name, onRefresh }: { name: string; onRefresh: () => void }) {
  return (
    <div className={runtimeCardWrapClass} role="status">
      <div className={runtimeCardClass}>
        <h2 className={runtimeCardTitleClass}>Checking {name}</h2>
        <p className={runtimeCardCopyClass}>Checking whether its local CLI is installed.</p>
        <div className={runtimeCardActionsClass}>
          <Button className={buttonVariants({ variant: 'outline', size: 'sm' })} onPress={onRefresh}>Refresh status</Button>
        </div>
      </div>
    </div>
  );
}

/** Runtime-readiness gates, most fundamental first: discovery has not
 *  answered yet, preparation is running, preparation failed, CLI missing.
 *  Renders `null` once the runtime is usable, so the caller's chat UI owns
 *  the pane. Pulled out of AgentView verbatim — pure presentation over the
 *  runtime descriptor plus a handful of retry/install callbacks, with no
 *  socket or session state of its own. */
export function AgentRuntimeGate({
  runtime,
  fallbackName,
  bootstrapActive,
  bootstrapFailed,
  runtimeUnavailable,
  onRefresh,
  onInstall,
  onCopyInstall,
  onOpenMcpSetup,
}: {
  runtime: Agent | undefined;
  fallbackName: string;
  bootstrapActive: boolean;
  bootstrapFailed: boolean;
  runtimeUnavailable: boolean;
  onRefresh: () => void;
  onInstall: () => void;
  onCopyInstall: () => void;
  onOpenMcpSetup: () => void;
}) {
  if (!runtime) {
    return <AgentRuntimeChecking name={fallbackName} onRefresh={onRefresh} />;
  }
  if (bootstrapActive) {
    return <AgentRuntimeProgress runtime={runtime} fallbackName={fallbackName} />;
  }
  if (bootstrapFailed) {
    return (
      <AgentRuntimeFailure
        runtime={runtime}
        fallbackName={fallbackName}
        onRetry={onInstall}
        onCopyInstall={onCopyInstall}
        onOpenMcpSetup={onOpenMcpSetup}
      />
    );
  }
  if (runtimeUnavailable) {
    return (
      <AgentRuntimeSetup
        runtime={runtime}
        fallbackName={fallbackName}
        onInstall={onInstall}
        onRefresh={onRefresh}
      />
    );
  }
  return null;
}
