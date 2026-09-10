import type { AppearanceSurface } from '@/shared/domain/appearance';

type AppearanceTheme = 'system' | 'light' | 'dark';
type AppearanceScale = 'small' | 'default' | 'large';

export interface AppearancePreferences {
  readonly theme: AppearanceTheme;
  readonly uiScale: AppearanceScale;
  readonly readingTextSize: AppearanceScale;
}

export type AppearanceField = keyof AppearancePreferences;

/** One field at a time, so one row's change is one field on the wire. */
export type AppearanceChange =
  | { readonly theme: AppearanceTheme }
  | { readonly uiScale: AppearanceScale }
  | { readonly readingTextSize: AppearanceScale };

/** Both scale rows offer the same three steps, so the steps are one
 *  vocabulary rather than a choice each row makes for itself. */
const SCALE_CHOICES: readonly { readonly label: string; readonly value: AppearanceScale }[] = [
  { label: 'Small', value: 'small' },
  { label: 'Default', value: 'default' },
  { label: 'Large', value: 'large' },
];

/** Parameterised by field so a row's choices cannot carry a value the field
 *  does not accept. */
interface AppearanceRowFor<Field extends AppearanceField> {
  readonly choices: readonly {
    readonly label: string;
    readonly value: AppearancePreferences[Field];
  }[];
  readonly detail: string;
  readonly field: Field;
  readonly title: string;
}

export type AppearanceRow =
  | AppearanceRowFor<'theme'>
  | AppearanceRowFor<'uiScale'>
  | AppearanceRowFor<'readingTextSize'>;

/** This one table drives all three rows and is the only list of labels, so a
 *  panel holds no per-preference branch. */
export const APPEARANCE_ROWS: readonly AppearanceRow[] = [
  {
    choices: [
      { label: 'Match system', value: 'system' },
      { label: 'Light', value: 'light' },
      { label: 'Dark', value: 'dark' },
    ],
    detail: 'Follows the operating system unless you pin a specific appearance.',
    field: 'theme',
    title: 'Theme',
  },
  {
    choices: SCALE_CHOICES,
    detail: 'Scales app controls and chrome without changing document text.',
    field: 'uiScale',
    title: 'Interface size',
  },
  {
    choices: SCALE_CHOICES,
    detail: 'Changes Markdown reading and editing text without affecting the interface.',
    field: 'readingTextSize',
    title: 'Reading text size',
  },
];

function chosen<Field extends AppearanceField>(
  row: AppearanceRowFor<Field>,
  value: string,
  change: (value: AppearancePreferences[Field]) => AppearanceChange,
): AppearanceChange | null {
  const choice = row.choices.find((candidate) => candidate.value === value);
  return choice ? change(choice.value) : null;
}

/** The DOM returns a radio's value as a string, so the table that names a
 *  field's choices is also what turns one back into a typed change. */
export function appearanceChange(field: AppearanceField, value: string): AppearanceChange | null {
  const row = APPEARANCE_ROWS.find((candidate) => candidate.field === field);
  if (!row) return null;
  switch (row.field) {
    case 'theme':
      return chosen(row, value, (theme) => ({ theme }));
    case 'uiScale':
      return chosen(row, value, (uiScale) => ({ uiScale }));
    case 'readingTextSize':
      return chosen(row, value, (readingTextSize) => ({ readingTextSize }));
  }
}

export function appearanceSurface(preferences: AppearancePreferences): AppearanceSurface {
  return {
    themeClass: preferences.theme === 'system' ? null : preferences.theme,
    uiScale: preferences.uiScale,
    readingTextSize: preferences.readingTextSize,
  };
}
