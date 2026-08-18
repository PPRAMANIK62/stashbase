/**
 * Durable user preferences the server persists to `~/.stashbase/config.json`
 * and the renderer edits in Settings.
 *
 * Appearance is deliberately a small set of presets rather than free-form
 * customization: the renderer applies each value as a document-level class,
 * so an unbounded value would have no styling to select. Onboarding records
 * which one-time notices a user has already seen, versioned so a later
 * revision of a notice can show again without reusing a dismissed flag.
 */

export type AppearanceTheme = 'system' | 'light' | 'dark';

export type AppearanceScale = 'small' | 'default' | 'large';

export interface AppearancePreferences {
  theme: AppearanceTheme;
  uiScale: AppearanceScale;
  readingTextSize: AppearanceScale;
}

export interface OnboardingPreferences {
  sourceCodeNoticeVersion?: number;
  unsupportedFormatsNoticeVersion?: number;
}
