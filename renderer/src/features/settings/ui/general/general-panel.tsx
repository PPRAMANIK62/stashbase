import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import type { TelemetryPort } from '@/features/settings/application/telemetry-port';
import type { LocalComponentViewModel } from '@/features/settings/hooks/use-local-component';
import {
  Disclosure,
  SettingsGroup,
  SettingsList,
  SettingsPane,
  SettingsRow,
} from '@/features/settings/ui/rows';
import type { SoftwareUpdateRow } from '@/shared/domain/software-update';
import { FailureNotice } from '@/shared/ui/failure-notice';

import { LocalComponentGroup } from './local-component-group';
import { TelemetryGroup } from './telemetry-group';

export interface GeneralPanelProps {
  updatePreview?: ReactNode;
  telemetryApi?: TelemetryPort | undefined;
  onOpenExternal?: ((href: string) => void) | undefined;
  localComponent?: LocalComponentViewModel | null;
  /** Null outside the desktop app, where there is no review window to open;
   *  the row then stays, disabled, and says so. */
  onReportBug: (() => void) | null;
  /** Null where the build has no updater, and then the group is not shown. */
  softwareUpdate: SoftwareUpdateRow | null;
}

export function GeneralPanel({
  localComponent,
  onReportBug,
  softwareUpdate,
  telemetryApi,
  onOpenExternal,
  updatePreview,
}: GeneralPanelProps) {
  return (
    <SettingsPane lede="App updates, local components, and support." title="General">
      {softwareUpdate && (
        <SettingsGroup
          hint={
            softwareUpdate.failure ? <FailureNotice failure={softwareUpdate.failure} /> : undefined
          }
          title="Software updates"
        >
          <SettingsList>
            <SettingsRow
              detail={softwareUpdate.status}
              title={`StashBase ${softwareUpdate.version}`}
              trail={
                <Button
                  disabled={softwareUpdate.busy}
                  onClick={softwareUpdate.act}
                  size="compact"
                  variant="tertiary"
                >
                  {softwareUpdate.actionLabel}
                </Button>
              }
            />
            <SettingsRow
              detail="Get notified when a new version is available."
              title="Check for updates automatically"
              trail={
                <Switch
                  checked={softwareUpdate.autoCheckEnabled}
                  // One command reaches the updater at a time, so a toggle
                  // offered mid-download would be silently dropped.
                  disabled={softwareUpdate.busy}
                  label="Check for updates automatically"
                  labelHidden
                  onToggle={() => softwareUpdate.setAutoCheck(!softwareUpdate.autoCheckEnabled)}
                />
              }
            />
          </SettingsList>
        </SettingsGroup>
      )}
      {localComponent && <LocalComponentGroup model={localComponent} />}
      {telemetryApi && onOpenExternal && (
        <TelemetryGroup port={telemetryApi} onOpenExternal={onOpenExternal} />
      )}
      <SettingsGroup title="Support">
        <SettingsList>
          <SettingsRow
            detail={
              onReportBug
                ? 'Review the report and attachments before sharing. Nothing is sent automatically.'
                : 'Available in the desktop app.'
            }
            title="Report a bug"
            trail={
              // The row already carries the name, so the control says only
              // what pressing it does, the way every other row here reads.
              <Button
                disabled={onReportBug === null}
                onClick={onReportBug ?? undefined}
                size="compact"
                variant="tertiary"
              >
                Start report…
              </Button>
            }
          />
        </SettingsList>
      </SettingsGroup>
      {updatePreview && (
        <SettingsGroup title="Developer">
          <Disclosure summary="Update notification preview">{updatePreview}</Disclosure>
        </SettingsGroup>
      )}
    </SettingsPane>
  );
}
