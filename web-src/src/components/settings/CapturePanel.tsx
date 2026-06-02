import { useEffect, useState } from 'react';
import { useApp } from '../../store/AppContext';

type CaptureAction = 'screen' | 'window' | 'region';

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
  shortcuts: Record<CaptureAction, string>;
  defaults: Record<CaptureAction, string>;
  registration: { registered: string[] };
}

interface CaptureBridge {
  getCaptureSettings?: () => Promise<CaptureSettings>;
  setCaptureShortcut?: (payload: { action: CaptureAction; accelerator: string }) => Promise<{
    ok: boolean;
    error?: string;
    settings?: CaptureSettings;
  }>;
  resetCaptureShortcuts?: () => Promise<{ ok: boolean; settings?: CaptureSettings; failures?: { error: string }[] }>;
  primeScreenRecordingPermission?: () => Promise<{ ok: boolean; error?: string }>;
  openScreenPermissionSettings?: () => Promise<{
    ok: boolean;
    opened: boolean;
    primed?: { ok: boolean; error?: string; permission?: CapturePermission };
    permission?: CapturePermission;
  }>;
}

const ACTIONS: { id: CaptureAction; label: string; detail: string }[] = [
  { id: 'screen', label: 'Full screen', detail: 'Capture the display nearest the cursor.' },
  { id: 'window', label: 'Window picker', detail: 'Open the window selection panel.' },
  { id: 'region', label: 'Region', detail: 'Drag a rectangle on the current display.' },
];

export function CapturePanel() {
  const { actions } = useApp();
  const [settings, setSettings] = useState<CaptureSettings | null>(null);
  const [draft, setDraft] = useState<Record<CaptureAction, string> | null>(null);
  const [busy, setBusy] = useState<CaptureAction | 'reset' | 'permission' | null>(null);
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
      setDraft(next.shortcuts);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function saveShortcut(action: CaptureAction) {
    const bridge = getBridge();
    if (!bridge?.setCaptureShortcut || !draft) return;
    setBusy(action);
    setError(null);
    try {
      const result = await bridge.setCaptureShortcut({ action, accelerator: draft[action] });
      if (result.settings) {
        setSettings(result.settings);
        setDraft(result.settings.shortcuts);
      }
      if (!result.ok) {
        setError(result.error || 'Shortcut could not be registered.');
        return;
      }
      actions.toast('Capture shortcut updated.', { level: 'success' });
    } finally {
      setBusy(null);
    }
  }

  async function resetShortcuts() {
    const bridge = getBridge();
    if (!bridge?.resetCaptureShortcuts) return;
    setBusy('reset');
    setError(null);
    try {
      const result = await bridge.resetCaptureShortcuts();
      if (result.settings) {
        setSettings(result.settings);
        setDraft(result.settings.shortcuts);
      }
      if (!result.ok) {
        setError(result.failures?.[0]?.error || 'One or more shortcuts could not be registered.');
        return;
      }
      actions.toast('Capture shortcuts reset.', { level: 'success' });
    } finally {
      setBusy(null);
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

  if (!settings || !draft) {
    return <div className="settings-panel-loading">{error || 'Loading…'}</div>;
  }

  const permission = settings.permission;
  const permissionOk = !permission.needsGuide;

  return (
    <div className="settings-panel">
      <div className="settings-section">
        <div className="settings-section-title">Screen Recording permission</div>
        <div className="settings-section-hint">
          Required on macOS before StashBase can capture other apps or the desktop. The button starts a direct screen-capture request so macOS registers the app in Screen Recording, then opens System Settings.
        </div>
        <div className={'capture-permission-card' + (permissionOk ? ' ok' : ' needs-attention')}>
          <div>
            <div className="capture-permission-title">
              {permissionOk ? 'Permission granted' : 'Permission required'}
            </div>
            <div className="capture-permission-detail">
              {permission.platform === 'darwin'
                ? `macOS Screen Recording status: ${permission.status}`
                : 'No extra screen recording permission is required on this platform.'}
            </div>
          </div>
          <div className="settings-actions-row">
            {permission.canOpenSettings && (
              <button
                type="button"
                className="settings-secondary-btn"
                disabled={busy === 'permission'}
                onClick={() => { void openPermissionSettings(); }}
              >
                Add and Open Settings
              </button>
            )}
            <button type="button" className="settings-secondary-btn" onClick={() => { void load(); }}>
              Refresh
            </button>
          </div>
        </div>
        {permission.platform === 'darwin' && permission.needsGuide && (
          <p className="settings-note">
            Turn on StashBase in Screen Recording, then restart StashBase so macOS applies the new permission.
          </p>
        )}
        {permission.platform === 'darwin' && !settings.identity.isPackaged && (
          <p className="settings-error">
            Development mode is running as {settings.identity.appName}. macOS may list Electron instead of StashBase; use a packaged StashBase.app when validating Screen Recording permissions.
          </p>
        )}
      </div>

      <div className="settings-section">
        <div className="settings-section-title">Global shortcuts</div>
        <div className="settings-section-hint">
          Use Electron accelerator syntax, for example <code>CommandOrControl+Shift+1</code>. Registration fails if another app owns the same shortcut.
        </div>
        <div className="capture-shortcut-list">
          {ACTIONS.map((item) => (
            <div className="capture-shortcut-row" key={item.id}>
              <div className="capture-shortcut-label">
                <span className="settings-radio-name">{item.label}</span>
                <span className="settings-radio-detail">
                  {item.detail}
                  {settings.registration.registered.includes(settings.shortcuts[item.id])
                    ? ''
                    : ' Shortcut is not registered.'}
                </span>
              </div>
              <input
                className="settings-text-input capture-shortcut-input"
                value={draft[item.id]}
                spellCheck={false}
                onChange={(e) => setDraft({ ...draft, [item.id]: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void saveShortcut(item.id);
                }}
              />
              <button
                type="button"
                className="settings-secondary-btn"
                disabled={busy === item.id || draft[item.id].trim() === settings.shortcuts[item.id]}
                onClick={() => { void saveShortcut(item.id); }}
              >
                Save
              </button>
            </div>
          ))}
        </div>
        <div className="settings-actions-row">
          <button
            type="button"
            className="settings-secondary-btn"
            disabled={busy === 'reset'}
            onClick={() => { void resetShortcuts(); }}
          >
            Reset shortcuts
          </button>
        </div>
        {error && <div className="settings-error">{error}</div>}
      </div>
    </div>
  );
}

function getBridge(): CaptureBridge | undefined {
  return (window as { electron?: CaptureBridge }).electron;
}
