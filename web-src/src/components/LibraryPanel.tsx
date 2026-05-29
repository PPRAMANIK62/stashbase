import { useApp } from '../store/AppContext';

/**
 * The "library" sidebar view — a file list scoped to the KB root
 * (one level above any space). Currently the only file that lives
 * here is `STASHBASE.md` (the agent-maintained library overview); the
 * panel is structured as a small file list so future root-level
 * documents can drop in without restructuring.
 *
 * Clicking a row opens the file in the main pane via the existing
 * `library`-kind tab path. The row matching whatever is currently
 * focused in the main pane gets the selected highlight.
 */
export function LibraryPanel() {
  const { state, actions } = useApp();
  const activeTab = state.tabs.find((t) => t.id === state.activeTabId);
  const libraryOpen = activeTab?.file?.kind === 'library';
  return (
    <div className="library-panel" id="sidebar-panel-library" role="tabpanel">
      <div className="library-panel-head">Knowledge base root</div>
      <div className="library-file-list">
        <button
          type="button"
          className={'library-file-row' + (libraryOpen ? ' selected' : '')}
          onClick={() => { void actions.openLibraryOverview(); }}
        >
          STASHBASE.md
        </button>
      </div>
    </div>
  );
}
