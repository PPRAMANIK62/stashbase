import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import type { TelemetryPort } from '@/features/settings/application/telemetry-port';
import { useTelemetry } from '@/features/settings/hooks/use-telemetry';
import { SettingsGroup, SettingsList, SettingsRow } from '@/features/settings/ui/rows';
import { FailureNotice } from '@/shared/ui/failure-notice';

const TELEMETRY_DETAILS_URL =
  'https://github.com/liliu-z/stashbase/blob/main/docs/usage-statistics.md';

export function TelemetryGroup({
  port,
  onOpenExternal,
}: {
  port: TelemetryPort;
  onOpenExternal(href: string): void;
}) {
  const model = useTelemetry(port);
  return (
    <SettingsGroup title="Privacy">
      <SettingsList>
        <SettingsRow
          title="Share basic usage statistics"
          detail="Send limited feature usage and failure categories to PostHog. Never includes documents, conversations, or file paths. Turning this off attempts one final notification, then stops statistics."
          trail={
            <Switch
              checked={model.preferences?.enabled ?? false}
              disabled={model.busy || !model.preferences}
              label="Share basic usage statistics"
              labelHidden
              onToggle={() =>
                model.change({ enabled: !model.preferences?.enabled, noticeSeen: true })
              }
            />
          }
        />
        <SettingsRow
          title="What gets sent"
          detail={
            model.preferences?.available === false
              ? 'This build does not send usage statistics.'
              : 'A random installation ID, app version, operating system, and a small list of events.'
          }
          trail={
            <Button
              size="compact"
              variant="tertiary"
              onClick={() => onOpenExternal(TELEMETRY_DETAILS_URL)}
            >
              View details
            </Button>
          }
        />
      </SettingsList>
      {model.failure && <FailureNotice failure={model.failure} />}
    </SettingsGroup>
  );
}
