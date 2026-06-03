import { useEffect, useState } from 'react';

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

  useEffect(() => {
    void load();
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
      const primed = settings?.permission.needsGuide
        ? await bridge.primeScreenRecordingPermission?.()
        : undefined;
      const result = await bridge.openScreenPermissionSettings();
      if (result.permission) {
        setSettings({ ...settings!, permission: result.permission });
      }
      if (primed && !primed.ok) {
        setError(primed.error || 'StashBase could not be added to Screen Recording automatically.');
      } else if (result.primed && !result.primed.ok) {
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
    </div>
  );
}

function getBridge(): CaptureBridge | undefined {
  return (window as { electron?: CaptureBridge }).electron;
}
