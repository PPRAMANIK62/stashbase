/**
 * Chrome-row chip that doubles as toggle + CLI picker for the terminal
 * panel. Two click zones:
 *   - Main (icon + label) → toggle the panel open / closed
 *   - Chevron (right edge) → open the CLI picker menu
 *
 * Mirrors the embedder chip's hover-bg / naked-by-default styling so
 * the two chrome controls read as a matched pair.
 */
import { useEffect, useRef, useState } from 'react';
import { api, type TerminalClisResponse } from '../api';
import { CheckIcon, ChevronDownIcon, TerminalIcon } from '../icons';
import { useApp } from '../store/AppContext';

export function TerminalCliPicker() {
  const { state, dispatch, actions } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const [uninstallingId, setUninstallingId] = useState<string | null>(null);
  const refreshedRef = useRef(false);

  // Pull the CLI registry once per app session — the install state
  // can drift (user installs codex from terminal) but for the chip
  // we mostly care about which one is selected. The picker menu
  // refreshes `installed` on each open for accuracy.
  useEffect(() => {
    if (refreshedRef.current) return;
    refreshedRef.current = true;
    api.listClis().then((r: TerminalClisResponse) => {
      dispatch({ type: 'TERMINAL_CLIS', current: r.current, clis: r.clis });
    }).catch(() => { /* renderer falls back to local defaults */ });
  }, [dispatch]);

  const current = state.terminalClis.find((c) => c.id === state.terminalCli);
  const label = current?.label ?? 'Claude Code';

  function refreshAndOpen() {
    // Re-fetch on menu open so `installed` reflects whatever the
    // user did in another terminal since they last clicked here.
    api.listClis().then((r: TerminalClisResponse) => {
      dispatch({ type: 'TERMINAL_CLIS', current: r.current, clis: r.clis });
    }).catch(() => { /* keep stale data */ });
    setMenuOpen(true);
  }

  function pick(id: string) {
    setMenuOpen(false);
    if (id === state.terminalCli) return;
    dispatch({ type: 'TERMINAL_CLI', id });
    api.setCli(id).catch(() => {
      // Server rejected — revert. Rare (only on unknown id).
      dispatch({ type: 'TERMINAL_CLI', id: state.terminalCli });
    });
  }

  async function uninstall(cli: { id: string; label: string; installHint: string }) {
    const cmd = cli.installHint.replace('install', 'uninstall');
    if (!(await actions.confirm(`Uninstall ${cli.label}?\n\nThis runs:\n${cmd}`))) return;
    setUninstallingId(cli.id);
    const es = new EventSource('/api/terminal/uninstall/' + encodeURIComponent(cli.id));
    // Uninstall is quick; we don't surface a live log (the install
    // card pattern is overkill for ~2 s of `npm rm`). Just signal
    // "running" on the row and refresh on exit.
    es.addEventListener('exit', () => {
      es.close();
      setUninstallingId(null);
      api.listClis().then((r) => {
        dispatch({ type: 'TERMINAL_CLIS', current: r.current, clis: r.clis });
      }).catch(() => { /* keep stale data */ });
    });
    es.addEventListener('error', () => {
      es.close();
      setUninstallingId(null);
    });
  }

  return (
    <div className="terminal-cli-picker">
      <button
        className={'terminal-toggle' + (state.terminalOpen ? ' active' : '')}
        type="button"
        title={state.terminalOpen ? `Hide ${label}` : `Open ${label}`}
        onClick={() => dispatch({ type: 'TERMINAL_TOGGLE' })}
      >
        <TerminalIcon />
        <span>{label}</span>
      </button>
      <button
        className={'terminal-cli-chev' + (menuOpen ? ' active' : '')}
        type="button"
        title="Switch CLI"
        onClick={() => (menuOpen ? setMenuOpen(false) : refreshAndOpen())}
      >
        <ChevronDownIcon />
      </button>
      {menuOpen && (
        <>
          <div className="embedder-backdrop" onClick={() => setMenuOpen(false)} />
          <div className="embedder-menu terminal-cli-menu" role="menu">
            <button
              type="button"
              className="embedder-menu-item embedder-menu-action"
              onClick={() => {
                // Bump the session counter — `<XtermView>` watches it
                // in effect deps and will tear the old WS + PTY down
                // before spawning a fresh one. Cheaper than a full
                // panel remount and keeps the picker styling clean.
                setMenuOpen(false);
                dispatch({ type: 'TERMINAL_NEW_SESSION' });
              }}
              title={`Start a fresh ${label} session (kills the current one)`}
            >Start new {label} session</button>
            {state.terminalClis.map((c) => {
              const busy = uninstallingId === c.id;
              return (
                <div
                  key={c.id}
                  className={'embedder-menu-item cli-row' + (c.id === state.terminalCli ? ' current' : '')}
                  role="menuitem"
                  onClick={() => pick(c.id)}
                >
                  <span className="embedder-menu-text">
                    <span className="embedder-menu-name">{c.label}</span>
                    <span className="embedder-menu-detail">
                      {c.vendor}{c.installed ? '' : ' · not installed'}
                    </span>
                  </span>
                  <span className="cli-row-actions">
                    {c.installed && (
                      <button
                        type="button"
                        className="cli-uninstall"
                        title={`Uninstall ${c.label}`}
                        disabled={busy}
                        onClick={(e) => { e.stopPropagation(); uninstall(c); }}
                      >{busy ? 'Uninstalling…' : 'Uninstall'}</button>
                    )}
                    {c.id === state.terminalCli && <CheckIcon className="embedder-menu-check" />}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
