import { Switch } from '@/components/ui/switch';
import type { CapturePort } from '@/features/settings/application/ports';
import { useCapture, type CaptureWatchApplier } from '@/features/settings/hooks/use-capture';
import { FailureNotice } from '@/features/settings/ui/failure-notice';
import {
  SettingsGroup,
  SettingsList,
  SettingsPane,
  SettingsRow,
} from '@/features/settings/ui/rows';

export interface GeneralPanelProps {
  applyCaptureWatch: CaptureWatchApplier;
  captureApi: CapturePort;
}

export function GeneralPanel({ applyCaptureWatch, captureApi }: GeneralPanelProps) {
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
    </SettingsPane>
  );
}
