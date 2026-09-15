import { Button } from '@/components/ui/button';
import type { TelemetryPort } from '@/features/settings/application/telemetry-port';
import { useTelemetry } from '@/features/settings/hooks/use-telemetry';
import { FailureNotice } from '@/shared/ui/failure-notice';

/** A visible, non-modal first-launch disclosure; nothing waits for dismissal. */
export function TelemetryNotice({ port }: { port: TelemetryPort }) {
  const model = useTelemetry(port);
  if (!model.preferences?.available || model.preferences.noticeSeen || !model.preferences.enabled)
    return null;
  return (
    <section aria-label="Usage statistics" className="border-b bg-muted px-4 py-3 text-sm">
      <p>
        Basic usage statistics are on. No documents, conversations, or file paths are sent. You can
        change this in Settings → General. Turning off attempts one final notification, then stops
        statistics.
      </p>
      <div className="mt-2 flex gap-2">
        <Button
          disabled={model.busy}
          size="compact"
          variant="tertiary"
          onClick={() => model.change({ noticeSeen: true })}
        >
          Got it
        </Button>
        <Button
          disabled={model.busy}
          size="compact"
          variant="tertiary"
          onClick={() => model.change({ enabled: false, noticeSeen: true })}
        >
          Turn off
        </Button>
      </div>
      {model.failure && <FailureNotice failure={model.failure} />}
    </section>
  );
}
