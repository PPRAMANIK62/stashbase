import { useEffect, useRef, useState } from 'react';
import {
  api,
  errorMessage,
  type AppearancePreferences,
  type AppearanceScale,
  type AppearanceTheme,
} from '../../api';
import { applyAppearance, publishAppearance, subscribeToAppearance } from '../../appearance';

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
}: {
  label: string;
  value: T;
  choices: Array<{ value: T; label: string; hint?: string }>;
  onChange: (value: T) => void;
  disabled: boolean;
}) {
  return (
    <div className="appearance-group">
      <div className="settings-section-title">{label}</div>
      <div className="appearance-options" aria-label={label}>
        {choices.map((choice) => (
          <button
            key={choice.value}
            type="button"
            className={`appearance-option${choice.value === value ? ' selected' : ''}`}
            aria-pressed={choice.value === value}
            disabled={disabled}
            onClick={() => onChange(choice.value)}
          >
            <span>{choice.label}</span>
            {choice.hint && <small>{choice.hint}</small>}
          </button>
        ))}
      </div>
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
      ? <div className="settings-error">Couldn’t load appearance: {error}</div>
      : <div className="settings-panel-loading">Loading…</div>;
  }
  return (
    <div className="settings-panel appearance-panel">
      <div className="settings-section">
        <div className="settings-section-title">Appearance</div>
        <div className="settings-section-hint">
          Choose a clear, durable presentation preset. Changes apply immediately and are saved for every window.
        </div>
        <PresetGroup label="Theme" value={preferences.theme} choices={THEMES} disabled={saving} onChange={(theme) => { void change({ theme }); }} />
        <PresetGroup label="Interface size" value={preferences.uiScale} choices={SCALES} disabled={saving} onChange={(uiScale) => { void change({ uiScale }); }} />
        <div className="settings-section-hint">Scales app controls and chrome without changing document text.</div>
        <PresetGroup label="Reading text size" value={preferences.readingTextSize} choices={SCALES} disabled={saving} onChange={(readingTextSize) => { void change({ readingTextSize }); }} />
        <div className="settings-section-hint">Changes Markdown reading and editing text without affecting the interface.</div>
        {error && <div className="settings-error">Couldn’t save appearance: {error}</div>}
      </div>
    </div>
  );
}
