import type { AppearancePort } from '@/features/settings/application/ports';
import { APPEARANCE_ROWS } from '@/features/settings/domain/appearance';
import { useAppearance } from '@/features/settings/hooks/use-appearance';
import { PresetChoice } from '@/features/settings/ui/appearance/preset-choice';
import {
  SettingsGroup,
  SettingsList,
  SettingsPane,
  SettingsRow,
} from '@/features/settings/ui/rows';
import { FailureNotice } from '@/shared/ui/failure-notice';

export interface AppearancePanelProps {
  appearanceApi: AppearancePort;
}

export function AppearancePanel({ appearanceApi }: AppearancePanelProps) {
  const appearance = useAppearance(appearanceApi);
  const preferences = appearance.preferences;

  return (
    <SettingsPane lede="Choices that apply to every StashBase window." title="Appearance">
      <SettingsGroup
        hint={appearance.failure ? <FailureNotice failure={appearance.failure} /> : undefined}
        title="Presentation"
      >
        <SettingsList>
          {APPEARANCE_ROWS.map((row) => (
            <SettingsRow
              detail={row.detail}
              key={row.field}
              title={row.title}
              trail={
                <PresetChoice
                  choices={row.choices}
                  disabled={preferences === null}
                  label={row.title}
                  onChoose={(value) => appearance.choose(row.field, value)}
                  value={preferences ? preferences[row.field] : null}
                />
              }
            />
          ))}
        </SettingsList>
      </SettingsGroup>
    </SettingsPane>
  );
}
