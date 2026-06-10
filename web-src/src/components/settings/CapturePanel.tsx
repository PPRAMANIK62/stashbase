import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '../../api';

interface CapturePermission {
  platform: string;
  status: string;
  needsGuide: boolean;
  canOpenSettings: boolean;
}

interface CaptureSettings {
  permission: CapturePermission;
  identity: {
    appName: string;
    isPackaged: boolean;
    executablePath: string;
    appPath: string;
  };
}

interface CaptureBridge {
  getCaptureSettings?: () => Promise<CaptureSettings>;
  primeScreenRecordingPermission?: () => Promise<{ ok: boolean; error?: string }>;
  openScreenPermissionSettings?: () => Promise<{
    ok: boolean;
    opened: boolean;
    primed?: { ok: boolean; error?: string; permission?: CapturePermission };
    permission?: CapturePermission;
  }>;
}

export function CapturePanel() {
  const [settings, setSettings] = useState<CaptureSettings | null>(null);
  const [busy, setBusy] = useState<'permission' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Gemini key state
  const [geminiHasKey, setGeminiHasKey] = useState<boolean | null>(null);
  const [geminiAddKey, setGeminiAddKey] = useState('');
  const [geminiAddBusy, setGeminiAddBusy] = useState(false);
  const [geminiAddError, setGeminiAddError] = useState<string | null>(null);
  const [geminiRemoveBusy, setGeminiRemoveBusy] = useState(false);

  useEffect(() => {
    void load();
    void api.getGeminiKey()
      .then((r) => setGeminiHasKey(r.hasKey))
      .catch(() => setGeminiHasKey(false));
  }, []);

  const geminiAddSubmit = useCallback(async () => {
    const trimmed = geminiAddKey.trim();
    if (!trimmed) { setGeminiAddError('Key required'); return; }
    setGeminiAddBusy(true);
    setGeminiAddError(null);
    try {
      await api.setGeminiKey(trimmed);
      setGeminiAddKey('');
      setGeminiHasKey(true);
    } catch (err: unknown) {
      setGeminiAddError(errorMessage(err));
    } finally {
      setGeminiAddBusy(false);
    }
  }, [geminiAddKey]);

  const geminiRemove = useCallback(async () => {
    setGeminiRemoveBusy(true);
    try {
      await api.removeGeminiKey();
      setGeminiHasKey(false);
    } finally {
      setGeminiRemoveBusy(false);
    }
  }, []);

  async function load() {
    const bridge = getBridge();
    if (!bridge?.getCaptureSettings) {
      setError('Capture settings are only available in the desktop app.');
      return;
    }
    try {
      const next = await bridge.getCaptureSettings();
      setSettings(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function openPermissionSettings() {
    const bridge = getBridge();
    if (!bridge?.openScreenPermissionSettings) return;
    setBusy('permission');
    setError(null);
    try {
      // `openScreenPermissionSettings` primes the permission internally
      // (a 1x1 desktopCapturer grab that fires the TCC prompt) before
      // opening System Settings, so we don't prime a second time here.
      const result = await bridge.openScreenPermissionSettings();
      if (result.permission) {
        setSettings({ ...settings!, permission: result.permission });
      }
      if (result.primed && !result.primed.ok) {
        setError(result.primed.error || 'StashBase could not be added to Screen Recording automatically.');
      }
    } finally {
      setBusy(null);
    }
  }

  if (!settings) {
    return <div className="settings-panel-loading">{error || 'Loading…'}</div>;
  }

  const permission = settings.permission;
  const permissionOk = !permission.needsGuide;

  return (
    <div className="settings-panel">
      <div className="settings-section">
        <div className="settings-section-title">Screen Recording</div>
        <div className="settings-section-hint">
          macOS needs this before StashBase can capture a window or the screen.
        </div>
        {permission.platform !== 'darwin' ? (
          <div className="settings-section-hint">No screen-recording permission is needed on this platform.</div>
        ) : (
          <>
            <p className="settings-section-hint">
              <strong className={permissionOk ? 'capture-state-ok' : 'capture-state-warn'}>
                {permissionOk ? 'Enabled.' : 'Not enabled.'}
              </strong>{' '}
              {permissionOk
                ? 'StashBase can capture the screen.'
                : 'Turn it on for StashBase in Screen Recording, then restart the app.'}
            </p>
            {!permissionOk && permission.canOpenSettings && (
              <div className="settings-actions-row">
                <button
                  type="button"
                  className="settings-secondary-btn"
                  disabled={busy === 'permission'}
                  onClick={() => { void openPermissionSettings(); }}
                >
                  Enable in System Settings
                </button>
              </div>
            )}
            {!settings.identity.isPackaged && (
              <div className="settings-section-hint settings-hint-foot">
                Dev build runs as Electron, so this status may be unreliable — validate with a packaged StashBase.app (<code>pnpm pack:mac</code>).
              </div>
            )}
          </>
        )}
        {error && <div className="settings-error">{error}</div>}
      </div>

      <div className="settings-section">
        <div className="settings-section-title">Gemini API key</div>
        <div className="settings-section-hint">
          When set, recordings are analyzed with Gemini's video understanding for
          better layout and multi-column extraction. Without a key, StashBase falls
          back to local frame-OCR.
        </div>
        {geminiHasKey ? (
          <div className="settings-actions-row">
            <button
              type="button"
              className="settings-secondary-btn danger"
              disabled={geminiRemoveBusy}
              onClick={() => { void geminiRemove(); }}
            >{geminiRemoveBusy ? 'Removing…' : 'Remove key…'}</button>
          </div>
        ) : (
          <>
            <div className="settings-field-row">
              <input
                type="password"
                className="settings-text-input"
                placeholder="AIza…"
                autoComplete="off"
                spellCheck={false}
                value={geminiAddKey}
                disabled={geminiAddBusy}
                onChange={(e) => { setGeminiAddKey(e.target.value); setGeminiAddError(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void geminiAddSubmit(); } }}
              />
              <button
                type="button"
                className="settings-primary-btn"
                onClick={() => { void geminiAddSubmit(); }}
                disabled={geminiAddBusy || !geminiAddKey.trim()}
              >{geminiAddBusy ? 'Saving…' : 'Add key'}</button>
            </div>
            {geminiAddError && <div className="settings-error">{geminiAddError}</div>}
          </>
        )}
        <div className="settings-section-hint settings-hint-foot">
          Stored locally in <code>~/.stashbase/config.json</code>. Recordings are
          uploaded to Google for analysis — opt in only if that's acceptable.
        </div>
      </div>
    </div>
  );
}

function getBridge(): CaptureBridge | undefined {
  return (window as { electron?: CaptureBridge }).electron;
}
