import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import type { CapturePort } from '@/features/settings/application/ports';
import { useCapture, type CaptureWatchApplier } from '@/features/settings/hooks/use-capture';
import {
  SettingsGroup,
  SettingsList,
  SettingsPane,
  SettingsRow,
} from '@/features/settings/ui/rows';
import type { SoftwareUpdateRow } from '@/shared/domain/software-update';
import { FailureNotice } from '@/shared/ui/failure-notice';

export interface GeneralPanelProps {
  applyCaptureWatch: CaptureWatchApplier;
  captureApi: CapturePort;
  /** Null where the build has no updater, and then the group is not shown. */
  softwareUpdate: SoftwareUpdateRow | null;
}

export function GeneralPanel({ applyCaptureWatch, captureApi, softwareUpdate }: GeneralPanelProps) {
  const capture = useCapture(captureApi, applyCaptureWatch);
  const enabled = capture.clipboardImageImport;

  return (
    <SettingsPane lede="Choices that apply to every folder in your library." title="General">
      <SettingsGroup
        hint={
          capture.failure ? (
            <FailureNotice failure={capture.failure} />
          ) : capture.warning ? (
            <span role="status">{capture.warning}</span>
          ) : undefined
        }
        title="Knowledge capture"
      >
        <SettingsList>
          <SettingsRow
            detail="When a StashBase window is focused and you copy an image, ask before adding it to the current folder for OCR and search."
            title="Offer to add clipboard screenshots"
            trail={
              <Switch
                checked={enabled}
                disabled={capture.disabled}
                label="Offer to add clipboard screenshots"
                labelHidden
                onToggle={() => capture.setClipboardImageImport(!enabled)}
              />
            }
          />
        </SettingsList>
      </SettingsGroup>
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
                  onClick={softwareUpdate.check}
                  size="compact"
                  variant="secondary"
                >
                  Check for updates
                </Button>
              }
            />
            <SettingsRow
              detail="Looks for a new version in the background and says so when one is waiting."
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
    </SettingsPane>
  );
}
