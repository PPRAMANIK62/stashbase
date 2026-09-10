import { Collapsible } from '@base-ui/react/collapsible';
import { RefreshCw } from 'lucide-react';
import { useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import type { AgentAllowance } from '@/features/settings/domain/agent-catalog';
import { ProgressBar, SettingsRow } from '@/features/settings/ui/rows';
import { useIcon } from '@/lib/icon-context';

/** The standing 7-day allowance: one bar and one sentence, with the token
 *  breakdown behind a disclosure most readers never open. */
export function AllowanceRow({
  allowance,
  onRefresh,
}: {
  allowance: AgentAllowance;
  onRefresh: () => void;
}) {
  const ChevronDown = useIcon('chevron-down');
  const ChevronRight = useIcon('chevron-right');
  const [detailOpen, setDetailOpen] = useState(false);
  const detailPanelId = useId();
  const percent = Math.max(0, Math.min(100, Math.round(allowance.remainingPercent)));
  const reset = allowance.windowEndsAt
    ? new Date(allowance.windowEndsAt).toLocaleString([], {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : null;

  return (
    <SettingsRow
      detail={`${percent}% remaining${reset ? ` · Resets ${reset}` : ' · Starts on first use'}`}
      title="7-day Agent allowance"
      trail={
        <Button leadingIcon={RefreshCw} onClick={onRefresh} size="compact" variant="ghost">
          Refresh
        </Button>
      }
    >
      <ProgressBar value={percent} />
      <Collapsible.Root className="mt-1" onOpenChange={setDetailOpen} open={detailOpen}>
        <Collapsible.Trigger
          render={
            <Button
              aria-controls={detailPanelId}
              className="-ml-1.5 h-auto gap-1.5 px-1.5 py-0.5 text-caption font-normal whitespace-nowrap"
              size="compact"
              trailingIcon={detailOpen ? ChevronDown : ChevronRight}
              variant="ghost"
            >
              Token detail
            </Button>
          }
        />
        <Collapsible.Panel className="pt-0.5 text-caption text-muted-foreground" id={detailPanelId}>
          {allowance.inputTokens.toLocaleString()} input · {allowance.outputTokens.toLocaleString()}{' '}
          output · {allowance.cacheReadTokens.toLocaleString()} cached
        </Collapsible.Panel>
      </Collapsible.Root>
    </SettingsRow>
  );
}
