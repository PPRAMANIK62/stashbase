import { useEffect, useState } from 'react';
import { api, errorMessage, type CapturePreferences } from '../../api';
import { electronBridge } from '../../electronBridge';

export function GeneralPanel() {
  const [preferences, setPreferences] = useState<CapturePreferences | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void api.capturePreferences()
      .then((next) => {
        if (!cancelled) setPreferences(next);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorMessage(err));
      });
    return () => { cancelled = true; };
  }, []);

  async function setClipboardImageImport(enabled: boolean) {
    if (!preferences) return;
    const previous = preferences;
    setPreferences({ ...preferences, clipboardImageImport: enabled });
    setSaving(true);
    setError(null);
    try {
      const saved = await api.setCapturePreferences({ clipboardImageImport: enabled });
      setPreferences(saved);
      try {
        const applied = await electronBridge()?.refreshClipboardWatch?.();
        if (applied !== undefined && applied !== saved.clipboardImageImport) {
          setError('Saved, but the desktop capture service could not apply the change. Restart StashBase to retry.');
        }
      } catch {
        setError('Saved, but the desktop capture service could not apply the change. Restart StashBase to retry.');
      }
    } catch (err: unknown) {
      setPreferences(previous);
      try {
        await electronBridge()?.refreshClipboardWatch?.();
      } catch { /* The persisted setting remains the authority. */ }
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (!preferences) {
    return error
      ? <div className="text-sm text-destructive">Couldn’t load capture settings: {error}</div>
      : <div className="py-3 text-base text-muted-foreground">Loading…</div>;
  }

  return (
    <div>
      <div className="mb-1 text-base font-semibold">Knowledge capture</div>
      <div className="text-sm leading-normal text-muted-foreground">
        Choose which ambient sources StashBase may notice. Nothing is added to a folder without confirmation.
      </div>
      <label className="mt-5.5 flex cursor-pointer items-start gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          className="mt-0.5 accent-accent"
          checked={preferences.clipboardImageImport}
          disabled={saving}
          onChange={(event) => { void setClipboardImageImport(event.target.checked); }}
        />
        <span>
          <span className="block font-semibold">Offer to add clipboard screenshots</span>
          <span className="mt-0.5 block leading-normal text-muted-foreground">
            While a StashBase window is focused, notice copied images and ask before adding one to the current folder for OCR and search.
          </span>
        </span>
      </label>
      {error && <div className="mt-2.5 text-sm text-destructive">Couldn’t save capture settings: {error}</div>}
    </div>
  );
}
