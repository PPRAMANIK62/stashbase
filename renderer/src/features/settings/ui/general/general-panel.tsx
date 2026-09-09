import { Switch } from '@/components/ui/switch';
import type { useCapture } from '@/features/settings/hooks/use-capture';
import {
  SettingsGroup,
  SettingsList,
  SettingsPane,
  SettingsRow,
} from '@/features/settings/ui/rows';

export interface GeneralPanelProps {
  capture: ReturnType<typeof useCapture>;
}

export function GeneralPanel({ capture }: GeneralPanelProps) {
  const enabled = capture.preferences.data?.clipboardImageImport ?? false;
  const disabled = capture.preferences.isPending || capture.update.isPending;
  const failure = capture.preferences.isError
    ? 'Capture settings are unavailable.'
    : capture.update.isError
      ? (capture.update.error?.message ?? 'Capture settings could not be saved.')
      : null;

  return (
    <SettingsPane lede="Choices that apply to every folder in your library." title="General">
      <SettingsGroup
        hint={
          failure ? (
            <span className="text-destructive" role="alert">
              {failure}
            </span>
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
                disabled={disabled}
                label="Offer to add clipboard screenshots"
                labelHidden
                onToggle={() => capture.update.mutate({ clipboardImageImport: !enabled })}
              />
            }
          />
        </SettingsList>
      </SettingsGroup>
    </SettingsPane>
  );
}
