import { useEffect, useState } from 'react';
import { api, errorMessage } from '../api';
import { useApp } from '../store/AppContext';

/**
 * The KB sidebar view — a file list scoped to the KB root.
 * Currently surfaces three classes of KB-level markdown:
 *
 *   - space-metadata.md   — agent-maintained KB 目录 (in .stashbase/)
 *   - STASHBASE.md        — KB-level rules book
 *   - <space>/STASHBASE.md — per-space rules book (one row per known
 *                            space)
 *
 * Clicking a row opens the file in the main pane via the existing
 * kb-kind tab path. The row matching whatever is currently
 * focused in the main pane gets the selected highlight; tabs dedupe
 * by name, so re-clicking the same row just activates the existing
 * tab.
 */
export function KbPanel() {
  const { state, actions } = useApp();
  const activeTab = state.tabs.find((t) => t.id === state.activeTabId);
  const activeName = activeTab?.file?.kind === 'kb' ? activeTab.file.name : null;

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
    <div className="kb-panel" id="sidebar-panel-kb" role="tabpanel">
      <div className="kb-panel-head">Knowledge base root</div>
      <div className="kb-file-list">
        <button
          type="button"
          className={'kb-file-row' + (activeName === 'space-metadata.md' ? ' selected' : '')}
          onClick={() => { void actions.openKbOverview(); }}
          title="Agent-maintained KB 目录 (.stashbase/space-metadata.md)"
        >
          space-metadata.md
        </button>
        <button
          type="button"
          className={'kb-file-row' + (activeName === 'STASHBASE.md' ? ' selected' : '')}
          onClick={() => { void actions.openKbRules(); }}
          title="KB-level maintenance rules"
        >
          STASHBASE.md
        </button>
      </div>

      <div className="kb-panel-head">Per-space rules</div>
      <div className="kb-file-list">
        {spacesError && (
          <div className="kb-file-empty">{spacesError}</div>
        )}
        {!spacesError && spaces.length === 0 && (
          <div className="kb-file-empty">No spaces yet</div>
        )}
        {spaces.map((name) => {
          const tabName = `${name}/STASHBASE.md`;
          return (
            <button
              key={name}
              type="button"
              className={'kb-file-row' + (activeName === tabName ? ' selected' : '')}
              onClick={() => { void actions.openSpaceRules(name); }}
              title={`Rules for the "${name}" space`}
            >
              <span className="kb-file-prefix">{name}/</span>
              <span>STASHBASE.md</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
