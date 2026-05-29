import { FilesViewIcon, LibraryIcon, SearchIcon } from '../icons';
import { useApp } from '../store/AppContext';

/**
 * Narrow left rail (à la VS Code / Obsidian) holding one icon per
 * sidebar view. Three mutually-exclusive views:
 *
 *   - files   → space-scoped tree + outline
 *   - search  → search input + result list
 *   - library → KB-root file list (currently STASHBASE.md only)
 *
 * Exactly one icon is "active" at a time — the active state is bound
 * to `state.activeSidebarView`, NOT to whatever happens to be focused
 * in the main pane, so the bar always reads as "what view am I in".
 * Default on first open is `files`; the choice is persisted to
 * localStorage by the AppProvider.
 */
export function ActivityBar() {
  const { state, dispatch, actions } = useApp();
  return (
    <nav className="activity-bar" role="tablist" aria-label="Sidebar views">
      <ActivityIcon
        active={state.activeSidebarView === 'files'}
        controls="sidebar-panel-files"
        label="Files (⌘⇧E)"
        onClick={() => dispatch({ type: 'SIDEBAR_VIEW', view: 'files' })}
      >
        <FilesViewIcon />
      </ActivityIcon>
      <ActivityIcon
        active={state.activeSidebarView === 'search'}
        controls="sidebar-panel-search"
        label="Search (⌘⇧F)"
        onClick={() => {
          dispatch({ type: 'SIDEBAR_VIEW', view: 'search' });
          // Focusing the input after the view switch lets ⌘⇧F (and a
          // mouse click) feel the same — both end with the caret in
          // the search box ready for typing.
          actions.focusSearch();
        }}
      >
        <SearchIcon />
      </ActivityIcon>
      <ActivityIcon
        active={state.activeSidebarView === 'library'}
        controls="sidebar-panel-library"
        label="Library (STASHBASE.md)"
        onClick={() => {
          dispatch({ type: 'SIDEBAR_VIEW', view: 'library' });
          // Auto-open the KB-root overview in the main pane so the
          // user lands on content immediately, not on an empty
          // selection. The LibraryPanel row also reflects this as
          // its "selected" highlight.
          void actions.openLibraryOverview();
        }}
      >
        <LibraryIcon />
      </ActivityIcon>
    </nav>
  );
}

interface ActivityIconProps {
  active: boolean;
  controls: string;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}

function ActivityIcon({ active, controls, label, onClick, children }: ActivityIconProps) {
  return (
    <button
      type="button"
      className={'activity-bar-btn' + (active ? ' active' : '')}
      role="tab"
      aria-selected={active}
      aria-controls={controls}
      onClick={onClick}
      title={label}
    >
      {children}
    </button>
  );
}
