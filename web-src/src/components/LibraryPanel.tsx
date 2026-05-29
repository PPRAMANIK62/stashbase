import { useEffect, useState } from 'react';
import { api, errorMessage } from '../api';
import { useApp } from '../store/AppContext';

/**
 * The "library" sidebar view — a file list scoped to the KB root.
 * Currently surfaces three classes of library-level markdown:
 *
 *   - AGENT.md            — agent-maintained library overview
 *   - STASHBASE.md        — KB-level rules book
 *   - <space>/STASHBASE.md — per-space rules book (one row per known
 *                            space)
 *
 * Clicking a row opens the file in the main pane via the existing
 * library-kind tab path. The row matching whatever is currently
 * focused in the main pane gets the selected highlight; tabs dedupe
 * by name, so re-clicking the same row just activates the existing
 * tab.
 */
export function LibraryPanel() {
  const { state, actions } = useApp();
  const activeTab = state.tabs.find((t) => t.id === state.activeTabId);
  const activeName = activeTab?.file?.kind === 'library' ? activeTab.file.name : null;

  const [spaces, setSpaces] = useState<string[]>([]);
  const [spacesError, setSpacesError] = useState<string | null>(null);

  // Per-space rules need the list of available spaces. Refresh on
  // mount + when the active space changes (covers create / rename
  // events landing while this view is open).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await api.listAvailableSpaces();
        if (!cancelled) setSpaces(r.names);
      } catch (err) {
        if (!cancelled) setSpacesError(errorMessage(err));
      }
    })();
    return () => { cancelled = true; };
  }, [state.space]);

  return (
    <div className="library-panel" id="sidebar-panel-library" role="tabpanel">
      <div className="library-panel-head">Knowledge base root</div>
      <div className="library-file-list">
        <button
          type="button"
          className={'library-file-row' + (activeName === 'AGENT.md' ? ' selected' : '')}
          onClick={() => { void actions.openLibraryOverview(); }}
          title="Agent-maintained library overview"
        >
          AGENT.md
        </button>
        <button
          type="button"
          className={'library-file-row' + (activeName === 'STASHBASE.md' ? ' selected' : '')}
          onClick={() => { void actions.openKbRules(); }}
          title="KB-level maintenance rules"
        >
          STASHBASE.md
        </button>
      </div>

      <div className="library-panel-head">Per-space rules</div>
      <div className="library-file-list">
        {spacesError && (
          <div className="library-file-empty">{spacesError}</div>
        )}
        {!spacesError && spaces.length === 0 && (
          <div className="library-file-empty">No spaces yet</div>
        )}
        {spaces.map((name) => {
          const tabName = `${name}/STASHBASE.md`;
          return (
            <button
              key={name}
              type="button"
              className={'library-file-row' + (activeName === tabName ? ' selected' : '')}
              onClick={() => { void actions.openSpaceRules(name); }}
              title={`Rules for the "${name}" space`}
            >
              <span className="library-file-prefix">{name}/</span>
              <span>STASHBASE.md</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
