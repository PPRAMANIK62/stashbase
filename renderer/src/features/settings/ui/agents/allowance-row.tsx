import { Button } from '@/components/ui/button';
import type { AgentAllowance } from '@/features/settings/domain/agent-catalog';
import { Disclosure, ProgressBar, SettingsRow } from '@/features/settings/ui/rows';
import { clamp } from '@/shared/utils/clamp';

/** OpenQuill's free credits, which refill on a fixed 7-day window: one bar
 *  and one sentence, with the token breakdown behind a disclosure most
 *  readers never open. */
export function AllowanceRow({
  allowance,
  onRefresh,
}: {
  allowance: AgentAllowance;
  onRefresh: () => void;
}) {
  const percent = clamp(Math.round(allowance.remainingPercent), 0, 100);
  const reset = allowance.windowEndsAt
    ? new Date(allowance.windowEndsAt).toLocaleString([], {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : null;

  return (
    <SettingsRow
      detail={`${percent}% remaining${reset ? ` · Refills ${reset}` : ' · Resets every 7 days from first use'}`}
      title="Free credits"
      trail={
        <Button onClick={onRefresh} size="compact" variant="ghost">
          Refresh
        </Button>
      }
    >
      <ProgressBar value={percent} />
      <Disclosure summary="Token usage">
        <p className="text-caption text-muted-foreground">
          {allowance.inputTokens.toLocaleString()} input · {allowance.outputTokens.toLocaleString()}{' '}
          output · {allowance.cacheReadTokens.toLocaleString()} cached
        </p>
      </Disclosure>
    </SettingsRow>
  );
}
