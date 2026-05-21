import { useEffect, useState } from 'react';
import { api, errorMessage } from '../api';
import { useApp } from '../store/AppContext';
import { ModalShell } from './ModalShell';

/**
 * Clone flow: user enters a git URL plus a space name (defaults to
 * the inferred repo name and stays in sync until the user edits it).
 * Server clones into `<kbRoot>/<name>` and we open it on success.
 *
 * No folder picker — spaces are flat under kbRoot, identified by
 * name, so a system dialog round-trip would be pure friction.
 */
function prettifyHome(abs: string, home: string): string {
  if (!home) return abs;
  if (abs === home) return '~';
  if (abs.startsWith(home + '/')) return '~/' + abs.slice(home.length + 1);
  return abs;
}

/** Mirror the server's `inferRepoName`: pull the tail segment off a
 *  git URL (`https://github.com/user/repo.git` → `repo`). Returns ''
 *  when the URL is incomplete. */
function inferRepoName(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, '').replace(/\.git$/, '');
  const m = trimmed.match(/[/:]([A-Za-z0-9._-]+)$/);
  return m ? m[1] : '';
}

export function CloneRepoModal({ onClose }: { onClose: () => void }) {
  const { state, actions } = useApp();
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  // Tracks whether the user has manually edited the name — once they
  // have, we stop auto-syncing it to the URL so their choice isn't
  // overwritten on the next keystroke.
  const [nameTouched, setNameTouched] = useState(false);
  const [kbRoot, setKbRoot] = useState('');
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState('Cloning…');
  const [error, setError] = useState<string | null>(null);

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

  function onUrlChange(v: string) {
    setUrl(v);
    if (!nameTouched) setName(inferRepoName(v));
  }

  async function submit() {
    const u = url.trim();
    if (!u) { setError('URL required'); return; }
    const n = (name.trim() || inferRepoName(u));
    if (!n) { setError('Could not derive a name from the URL — enter one manually.'); return; }
    if (n.includes('/') || n.includes('\\') || n.startsWith('.')) {
      setError('Name cannot contain slashes or start with "."');
      return;
    }
    setError(null);
    setBusy(true);
    setBusyLabel('Cloning…');
    try {
      await api.gitClone(u, n);
      setBusyLabel('Opening…');
      // Close before openSpaceByName so the welcome overlay's fade-out
      // and the new space's first paint don't race over each other.
      onClose();
      await actions.openSpaceByName(n);
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
        Clones into <code>{rootDisplay}/&lt;name&gt;</code>. The name
        defaults to the repo name — edit if you want a different one.
      </p>
      <input
        type="text"
        className="modal-input"
        placeholder="https://github.com/user/repo.git"
        autoComplete="off"
        spellCheck={false}
        value={url}
        onChange={(e) => onUrlChange(e.target.value)}
        disabled={busy}
        autoFocus
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === 'Enter') { e.preventDefault(); void submit(); }
          else if (e.key === 'Escape' && !busy) { e.preventDefault(); onClose(); }
        }}
      />
      <input
        type="text"
        className="modal-input"
        placeholder="Space name"
        autoComplete="off"
        spellCheck={false}
        value={name}
        onChange={(e) => { setName(e.target.value); setNameTouched(true); }}
        disabled={busy}
        style={{ marginTop: 8 }}
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
        >{busy ? busyLabel : 'Clone'}</button>
      </div>
    </ModalShell>
  );
}
