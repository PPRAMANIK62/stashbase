import { useEffect, useState } from 'react';
import { api, errorMessage } from '../api';
import { CubeLogoIcon, FolderIcon, GitCloneIcon, NewFolderIcon } from '../icons';
import { useApp } from '../store/AppContext';
import { CloneRepoModal } from './CloneRepoModal';
import { openMcpSettings } from './McpSettingsButton';

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

/** Shorten an absolute path for display: `/Users/foo/Notes` → `~/Notes`
 *  when it lives under the user's home dir. Falls through unchanged
 *  otherwise (e.g. `/tmp/scratch`). */
function prettifyHome(abs: string, home: string): string {
  if (!home) return abs;
  if (abs === home) return '~';
  if (abs.startsWith(home + '/')) return '~/' + abs.slice(home.length + 1);
  return abs;
}

/**
 * Landing overlay shown when no space is open (or after the user
 * explicitly goes home). All spaces must live under the library root
 * (`~/Documents/StashBase/` by default).
 *
 * Open / New / Clone all use the native OS folder dialog with
 * `defaultPath = kbRoot` so the user lands in the right place and can
 * use the "New Folder" affordance. The picker is unrestricted (it'd
 * be a worse UX to disable the rest of the filesystem), so we
 * validate the pick is under kbRoot client-side; the server
 * re-validates inside `setCurrentSpace`.
 */
export function Welcome() {
  const { state, actions, dispatch } = useApp();
  const [cloneOpen, setCloneOpen] = useState(false);
  const [kbRoot, setKbRoot] = useState('');

  // Fetch the kbRoot once the welcome screen mounts so the OS dialog
  // can seed `defaultPath` and so we can validate picks client-side.
  useEffect(() => {
    void (async () => {
      try {
        const r = await api.getKbRoot();
        setKbRoot(r.path);
      } catch (err) {
        dispatch({ type: 'WELCOME_ERROR', error: errorMessage(err) });
      }
    })();
  }, [dispatch]);

  if (!state.welcomeVisible) return null;

  async function pickAndOpen(mode: 'open' | 'new') {
    const bridge = window.electron;
    if (!bridge?.openFolderDialog) {
      dispatch({
        type: 'WELCOME_ERROR',
        error: 'Folder picker requires the desktop app. Run `npm run electron`.',
      });
      return;
    }
    if (!kbRoot) {
      dispatch({ type: 'WELCOME_ERROR', error: 'Library root not loaded yet — try again in a moment.' });
      return;
    }
    // The dialog title hints at which affordance to use; the actual
    // dialog is identical (createDirectory is always enabled).
    const picked = await bridge.openFolderDialog({
      title: mode === 'new' ? 'New space — pick or create a folder' : 'Open a space',
      buttonLabel: mode === 'new' ? 'Use folder' : 'Open',
      defaultPath: kbRoot,
    });
    if (!picked) return;
    // Enforce the kbRoot invariant: must be the root itself's child or
    // deeper (the root itself is a container, not openable as a space).
    const rootWithSep = kbRoot.endsWith('/') ? kbRoot : kbRoot + '/';
    if (picked === kbRoot || !picked.startsWith(rootWithSep)) {
      dispatch({
        type: 'WELCOME_ERROR',
        error: `Spaces must live under ${prettifyHome(kbRoot, state.homeDir ?? '')}.`,
      });
      return;
    }
    await actions.openSpace(picked);
  }

  function openClone() {
    if (!window.electron?.openFolderDialog) {
      dispatch({
        type: 'WELCOME_ERROR',
        error: 'Clone requires the desktop app. Run `npm run electron`.',
      });
      return;
    }
    setCloneOpen(true);
  }

  return (
    <div className="welcome">
      <div className="welcome-inner">
        <div className="welcome-brand">
          <div className="welcome-logo">
            <CubeLogoIcon />
          </div>
          <div className="welcome-title">StashBase</div>
          <div className="welcome-sub">
            Local knowledge base for you and your AI.
            <br />
            HTML-first, continuously indexed, MCP-compatible.
          </div>
        </div>

        <div className="welcome-actions">
          <button className="welcome-action" type="button" onClick={() => pickAndOpen('open')}>
            <span className="welcome-action-icon">
              <FolderIcon />
            </span>
            <span className="welcome-action-label">Open space</span>
          </button>
          <button className="welcome-action" type="button" onClick={() => pickAndOpen('new')}>
            <span className="welcome-action-icon">
              <NewFolderIcon />
            </span>
            <span className="welcome-action-label">New space</span>
          </button>
          <button className="welcome-action" type="button" onClick={openClone}>
            <span className="welcome-action-icon">
              <GitCloneIcon />
            </span>
            <span className="welcome-action-label">Clone repo</span>
          </button>
        </div>

        <div className="welcome-mcp">
          <div className="welcome-mcp-text">
            <div className="welcome-mcp-title">Connect AI tools</div>
            <div className="welcome-mcp-sub">
              Use MCP Settings to connect StashBase to Claude Code, Codex, Cursor, Gemini, and other MCP clients.
            </div>
          </div>
          <button className="welcome-mcp-btn" type="button" onClick={openMcpSettings}>
            Open MCP Settings
          </button>
        </div>

        {state.recent.length > 0 && (
          <div className="welcome-recent">
            <div className="welcome-recent-head">Recent spaces</div>
            <div className="welcome-recent-list">
              {state.recent.map((r) => {
                const name = r.path.split('/').filter(Boolean).pop() || r.path;
                return (
                  <div
                    key={r.path}
                    className="welcome-recent-row"
                    onClick={() => { void actions.openSpace(r.path); }}
                  >
                    <span className="welcome-recent-name">{name}</span>
                    <span className="welcome-recent-path">{prettifyHome(r.path, state.homeDir)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {state.welcomeError && (
          <div className="welcome-err">{state.welcomeError}</div>
        )}
      </div>
      {cloneOpen && <CloneRepoModal onClose={() => setCloneOpen(false)} />}
    </div>
  );
}
