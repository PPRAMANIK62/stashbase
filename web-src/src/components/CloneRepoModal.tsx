import { useEffect, useState } from 'react';
import { api, errorMessage } from '../api';
import { useApp } from '../store/AppContext';
import { ModalShell } from './ModalShell';

interface ElectronAPI {
  openFolderDialog?: (opts: {
    title?: string;
    buttonLabel?: string;
    defaultPath?: string;
  }) => Promise<string | null>;
}
declare global {
  interface Window { electron?: ElectronAPI }
}

/**
 * Two-step clone flow:
 *   1. User types a git URL in this modal.
 *   2. We open the OS folder dialog (rooted at the library folder) so
 *      they can choose / create the parent directory using the native
 *      "New Folder" affordance.
 *
 * After picking, the absolute path is validated against the kbRoot
 * invariant client-side; out-of-root selections surface inline with an
 * error and the modal stays open so the user can retry. The path is
 * then handed to the server as a relative subpath (server re-validates
 * before clone).
 */
function prettifyHome(abs: string, home: string): string {
  if (!home) return abs;
  if (abs === home) return '~';
  if (abs.startsWith(home + '/')) return '~/' + abs.slice(home.length + 1);
  return abs;
}

export function CloneRepoModal({ onClose }: { onClose: () => void }) {
  const { state, actions } = useApp();
  const [url, setUrl] = useState('');
  const [kbRoot, setKbRoot] = useState('');
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState('Cloning…');
  const [error, setError] = useState<string | null>(null);

  // Fetch kbRoot up front so step 2 can both seed the dialog's
  // `defaultPath` and validate the user's pick without a round-trip.
  useEffect(() => {
    void (async () => {
      try {
        const r = await api.getKbRoot();
        setKbRoot(r.path);
      } catch (err) {
        setError(errorMessage(err));
      }
    })();
  }, []);

  async function submit() {
    const u = url.trim();
    if (!u) { setError('URL required'); return; }
    const bridge = window.electron;
    if (!bridge?.openFolderDialog) {
      setError('Folder picker requires the desktop app.');
      return;
    }
    if (!kbRoot) {
      setError('Library root not loaded yet — try again in a moment.');
      return;
    }
    setError(null);
    const picked = await bridge.openFolderDialog({
      title: 'Clone into…',
      buttonLabel: 'Clone here',
      defaultPath: kbRoot,
    });
    if (!picked) return; // user cancelled the picker — modal stays open

    // kbRoot invariant: parent must be the library root or a descendant.
    // The server re-validates, but checking client-side gives a nicer
    // error than a 400 round-trip.
    const rootWithSep = kbRoot.endsWith('/') ? kbRoot : kbRoot + '/';
    let relParent = '';
    if (picked === kbRoot) {
      relParent = '';
    } else if (picked.startsWith(rootWithSep)) {
      relParent = picked.slice(rootWithSep.length);
    } else {
      setError(`Folder must be under ${prettifyHome(kbRoot, state.homeDir ?? '')}.`);
      return;
    }

    setBusy(true);
    setBusyLabel('Cloning…');
    try {
      const { path } = await api.gitClone(u, relParent);
      setBusyLabel('Opening…');
      // Close before openSpace so the welcome overlay's fade-out and
      // the new space's first paint don't race over each other.
      onClose();
      await actions.openSpace(path);
    } catch (err: any) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  const rootDisplay = kbRoot ? prettifyHome(kbRoot, state.homeDir ?? '') : '~/Documents/StashBase';

  return (
    <ModalShell onCancel={busy ? () => { /* swallow during clone */ } : onClose}>
      <h3>Clone repository</h3>
      <p className="modal-hint">
        Git URL (HTTPS or SSH). After clicking Clone you'll pick a
        parent folder under <code>{rootDisplay}</code> (you can create
        a new folder in the dialog).
      </p>
      <input
        type="text"
        className="modal-input"
        placeholder="https://github.com/user/repo.git"
        autoComplete="off"
        spellCheck={false}
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        disabled={busy}
        autoFocus
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === 'Enter') { e.preventDefault(); void submit(); }
          else if (e.key === 'Escape' && !busy) { e.preventDefault(); onClose(); }
        }}
      />
      {error && <div className="modal-error">{error}</div>}
      <div className="modal-actions">
        <button type="button" className="modal-btn" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button
          type="button"
          className="modal-btn primary"
          onClick={() => { void submit(); }}
          disabled={busy || !url.trim()}
        >{busy ? busyLabel : 'Clone…'}</button>
      </div>
    </ModalShell>
  );
}
