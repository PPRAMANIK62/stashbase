import { useEffect, useState } from 'react';
import { api, ApiError, errorMessage } from '../../api';
import { useApp } from '../../store/AppContext';

interface ElectronBridge {
  openFolderDialog?: (opts?: unknown) => Promise<string | null>;
}

function homeDisplay(abs: string, home: string): string {
  if (!home) return abs;
  if (abs === home) return '~';
  if (abs.startsWith(home + '/')) return '~/' + abs.slice(home.length + 1);
  return abs;
}

export function LibraryPanel() {
  const { state, actions } = useApp();
  const [kbRoot, setKbRoot] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void api.getKbRoot()
      .then((r) => setKbRoot(r.path))
      .catch((err) => setError(errorMessage(err)));
  }, []);

  async function choose() {
    const bridge = (window as { electron?: ElectronBridge }).electron;
    const picked = await bridge?.openFolderDialog?.({
      title: 'Choose KB root',
      buttonLabel: 'Use as KB Root',
      defaultPath: kbRoot || undefined,
    });
    if (picked) setKbRoot(picked);
  }

  async function save() {
    const next = kbRoot.trim();
    if (!next) { setError('Path required'); return; }
    const ok = await actions.confirm(
      'Changing the KB root closes the current space and clears recent spaces for the new library. Continue?',
    );
    if (!ok) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      let r;
      try {
        r = await api.setKbRoot(next);
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          const allow = await actions.confirm('That directory is not empty. Use it as the KB root anyway?');
          if (!allow) return;
          r = await api.setKbRoot(next, true);
        } else {
          throw err;
        }
      }
      setKbRoot(r.path);
      actions.goHome();
      await actions.bootstrap();
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="settings-panel">
      <div className="settings-section-title">KB root</div>
      <p className="settings-copy">
        Spaces are direct child folders inside this directory. Switching roots starts from a fresh library view.
      </p>
      <div className="settings-field-row">
        <input
          className="settings-text-input"
          value={kbRoot}
          disabled={busy}
          onChange={(e) => setKbRoot(e.target.value)}
          spellCheck={false}
        />
        <button type="button" className="settings-secondary-btn" onClick={choose} disabled={busy}>
          Browse
        </button>
        <button type="button" className="settings-primary-btn" onClick={() => { void save(); }} disabled={busy || !kbRoot.trim()}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
      {state.homeDir && kbRoot && (
        <div className="settings-note">{homeDisplay(kbRoot, state.homeDir)}</div>
      )}
      {saved && <div className="settings-ok">KB root updated.</div>}
      {error && <div className="settings-error">{error}</div>}
    </div>
  );
}
