import { useState } from 'react';
import { api, errorMessage } from '../api';
import { useApp } from '../store/AppContext';
import { ModalShell } from './ModalShell';

/**
 * Two-step clone flow launched from the Welcome screen's "Clone repo"
 * action:
 *   1. User types a git URL in this modal.
 *   2. We pop the OS folder dialog to pick the parent directory.
 *
 * Server clones into `<parentDir>/<inferred-name>` (it also strips any
 * `.stashbase/` the repo may have committed — see `/api/git/clone` /
 * arch.md decision 31). On success we hand the resulting absolute path
 * straight to `actions.openSpace`, so the user lands in the fresh
 * working tree.
 *
 * We block the modal (`busy`) while git runs because we don't have a
 * progress channel to stream into the UI yet. Failures surface inline
 * via `setError`; no native alert.
 */
export function CloneRepoModal({ onClose }: { onClose: () => void }) {
  const { actions } = useApp();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState('Cloning…');
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const u = url.trim();
    if (!u) { setError('URL required'); return; }
    const bridge = window.electron;
    if (!bridge?.openFolderDialog) {
      setError('Folder picker requires the desktop app.');
      return;
    }
    setError(null);
    const parentDir = await bridge.openFolderDialog({
      title: 'Clone into…',
      buttonLabel: 'Clone here',
    });
    if (!parentDir) return; // user cancelled the picker — modal stays open
    setBusy(true);
    setBusyLabel('Cloning…');
    try {
      const { path } = await api.gitClone(u, parentDir);
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

  return (
    <ModalShell onCancel={busy ? () => { /* swallow during clone */ } : onClose}>
      <h3>Clone repository</h3>
      <p className="modal-hint">
        Git URL (HTTPS or SSH). The cloned working tree becomes a space —
        its files are your knowledge base. After clone you'll pick the
        parent folder it lands in.
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
          disabled={busy}
        >{busy ? busyLabel : 'Clone…'}</button>
      </div>
    </ModalShell>
  );
}
