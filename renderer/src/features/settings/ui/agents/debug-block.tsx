import { useId } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import type {
  AgentDiscoverySource,
  AgentSetupSimulation,
  AgentTurnSimulation,
} from '@/features/settings/domain/agent-catalog';
import type { AgentRuntimesViewModel } from '@/features/settings/hooks/use-agent-runtimes';
import { FailureNotice } from '@/features/settings/ui/failure-notice';
import { Disclosure } from '@/features/settings/ui/rows';

/**
 * Development-only preparation controls.
 *
 * The view model reports `catalog.debug` only when the server says debugging
 * is on — the renderer has no environment-variable authority of its own to
 * decide this — so an absent block here means the server withheld it.
 */

const DISCOVERY_SOURCES: ReadonlyArray<{ value: AgentDiscoverySource; label: string }> = [
  { value: 'auto', label: 'Auto' },
  { value: 'managed-only', label: 'Managed only' },
  { value: 'system-only', label: 'System only' },
];

const SETUP_FAILURES: ReadonlyArray<{ value: AgentSetupSimulation; label: string }> = [
  { value: 'none', label: 'Normal' },
  { value: 'installation', label: 'Fail installation' },
  { value: 'authentication', label: 'Signed-out Codex' },
  { value: 'mcp', label: 'Fail MCP connection' },
];

const TURN_FAILURES: ReadonlyArray<{ value: AgentTurnSimulation; label: string }> = [
  { value: 'none', label: 'Normal' },
  { value: 'rate-limit', label: 'Rate limited (429)' },
  { value: 'quota', label: 'Usage limit reached' },
  { value: 'auth-expired', label: 'Auth token expired' },
  { value: 'network', label: 'Network unreachable' },
  { value: 'crash', label: 'Runtime crash' },
];

function DebugSelectRow<Value extends string>({
  disabled,
  items,
  label,
  onChange,
  value,
}: {
  disabled: boolean;
  items: ReadonlyArray<{ value: Value; label: string }>;
  label: string;
  onChange: (value: Value) => void;
  value: Value;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <label className="text-caption text-foreground" htmlFor={id}>
        {label}
      </label>
      <Select
        disabled={disabled}
        // The rows below map the same array, so the trigger's label and the
        // popup's rows cannot drift.
        items={items}
        onValueChange={(next) => onChange(next as Value)}
        size="compact"
        value={value}
      >
        <SelectTrigger className="min-w-40" id={id} />
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function DebugBlock({ runtimes }: { runtimes: AgentRuntimesViewModel }) {
  const debug = runtimes.catalog.debug;
  if (!debug) return null;
  const busy = runtimes.debugBusy;

  return (
    <Disclosure
      badge={
        <Badge color="amber" size="compact">
          Development only
        </Badge>
      }
      summary="Agent bootstrap testing"
    >
      <p className="text-caption text-muted-foreground">
        These controls change discovery inside StashBase only — they never uninstall a global Agent
        or clear provider credentials.
      </p>
      <DebugSelectRow
        disabled={busy}
        items={DISCOVERY_SOURCES}
        label="Discovery source"
        onChange={(discoverySource) => runtimes.updateDebug({ discoverySource })}
        value={debug.discoverySource}
      />
      <DebugSelectRow
        disabled={busy}
        items={SETUP_FAILURES}
        label="Next setup result"
        onChange={(nextSetupResult) => runtimes.updateDebug({ nextSetupResult })}
        value={debug.nextSetupResult}
      />
      <DebugSelectRow
        disabled={busy}
        items={TURN_FAILURES}
        label="Next turn result"
        onChange={(nextTurnResult) => runtimes.updateDebug({ nextTurnResult })}
        value={debug.nextTurnResult}
      />
      <div className="mt-2.5 flex flex-wrap gap-2">
        <Button
          disabled={busy}
          onClick={() => runtimes.resetFirstRun('codex')}
          size="compact"
          variant="tertiary"
        >
          Reset Codex first run
        </Button>
        <Button
          disabled={busy}
          onClick={() => runtimes.resetFirstRun('claude')}
          size="compact"
          variant="tertiary"
        >
          Reset Claude first run
        </Button>
      </div>
      {runtimes.debugFailure && (
        <FailureNotice className="mt-2.5" failure={runtimes.debugFailure} />
      )}
    </Disclosure>
  );
}
