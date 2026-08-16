import { useEffect, useRef, useState } from 'react';
import {
  api,
  errorMessage,
  type AppearancePreferences,
  type AppearanceScale,
  type AppearanceTheme,
} from '@/api';
import { applyAppearance, publishAppearance, subscribeToAppearance } from '@/features/settings/lib/appearance';
import { SegmentedControl, SegmentedControlItem } from '@/components/ui/segmented-control';

const THEMES: Array<{ value: AppearanceTheme; label: string; hint: string }> = [
  { value: 'system', label: 'System', hint: 'Follow your operating system.' },
  { value: 'light', label: 'Light', hint: 'Always use the light appearance.' },
  { value: 'dark', label: 'Dark', hint: 'Always use the dark appearance.' },
];

const SCALES: Array<{ value: AppearanceScale; label: string }> = [
  { value: 'small', label: 'Small' },
  { value: 'default', label: 'Default' },
  { value: 'large', label: 'Large' },
];

function PresetGroup<T extends string>({
  label,
  value,
  choices,
  onChange,
  disabled,
  hint,
}: {
  label: string;
  value: T;
  choices: Array<{ value: T; label: string; hint?: string }>;
  onChange: (value: T) => void;
  disabled: boolean;
  hint?: string;
}) {
  return (
    <div className="mt-5.5">
      <div className="mb-1.5 text-base font-semibold">{label}</div>
      <SegmentedControl
        aria-label={label}
        disabled={disabled}
        value={[value]}
        onValueChange={(next) => {
          const choice = next[0] as T | undefined;
          if (choice && choice !== value) onChange(choice);
        }}
      >
        {choices.map((choice) => (
          <SegmentedControlItem
            key={choice.value}
            value={choice.value}
            className="min-w-18"
            title={choice.hint}
          >
            {choice.label}
          </SegmentedControlItem>
        ))}
      </SegmentedControl>
      {hint && <div className="mt-1.5 text-sm leading-normal text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function AppearancePanel() {
  const [preferences, setPreferences] = useState<AppearancePreferences | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const revisionRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let receivedWindowUpdate = false;
    const unsubscribe = subscribeToAppearance((next) => {
      receivedWindowUpdate = true;
      revisionRef.current += 1;
      if (!cancelled) setPreferences(next);
    });
    api.appearance()
      .then((next) => {
        // A save in another window can arrive while this request is in
        // flight. Its broadcast is newer than this snapshot, so never let a
        // late GET roll the panel (or this window) back to stale values.
        if (cancelled || receivedWindowUpdate) return;
        setPreferences(next);
        // The app shell normally applies this on startup. Keep this local
        // fallback for a recoverable shell-load failure, but initial reads
        // must not broadcast and overwrite newer choices in other windows.
        applyAppearance(next);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  async function change(next: Partial<AppearancePreferences>) {
    if (!preferences) return;
    const optimistic = { ...preferences, ...next };
    const revision = revisionRef.current + 1;
    revisionRef.current = revision;
    setPreferences(optimistic);
    setSaving(true);
    setError(null);
    publishAppearance(optimistic);
    try {
      const saved = await api.setAppearance(next);
      setPreferences(saved);
      publishAppearance(saved);
    } catch (err: unknown) {
      if (revisionRef.current === revision) {
        setPreferences(preferences);
        publishAppearance(preferences);
      }
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (!preferences) {
    return error
      ? <div className="text-sm text-destructive">Couldn’t load appearance: {error}</div>
      : <div className="py-3 text-base text-muted-foreground">Loading…</div>;
  }
  return (
    <div>
      <div className="mb-1 text-base font-semibold">Appearance</div>
      <div className="text-sm leading-normal text-muted-foreground">
        Choose a clear, durable presentation preset. Changes apply immediately and are saved for every window.
      </div>
      <PresetGroup label="Theme" value={preferences.theme} choices={THEMES} disabled={saving} onChange={(theme) => { void change({ theme }); }} />
      <PresetGroup label="Interface size" value={preferences.uiScale} choices={SCALES} disabled={saving} onChange={(uiScale) => { void change({ uiScale }); }} hint="Scales app controls and chrome without changing document text." />
      <PresetGroup label="Reading text size" value={preferences.readingTextSize} choices={SCALES} disabled={saving} onChange={(readingTextSize) => { void change({ readingTextSize }); }} hint="Changes Markdown reading and editing text without affecting the interface." />
      {error && <div className="mt-2.5 text-sm text-destructive">Couldn’t save appearance: {error}</div>}
    </div>
  );
}
