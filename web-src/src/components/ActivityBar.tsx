import { FilesViewIcon, KbIcon, SearchIcon, SettingsIcon } from '../icons';
import { useApp } from '../store/AppContext';
import { openSettings } from './SettingsModal';

/**
 * Narrow left rail (à la VS Code / Obsidian) holding one icon per
 * sidebar view. Three mutually-exclusive views:
 *
 *   - files   → space-scoped tree
 *   - search  → search input + result list
 *   - kb → KB-root file list (currently STASHBASE.md only)
 *
 * Exactly one icon is "active" at a time — the active state is bound
 * to `state.activeSidebarView`, NOT to whatever happens to be focused
 * in the main pane, so the bar always reads as "what view am I in".
 * Default on first open is `files`; the choice is persisted to
 * localStorage by the AppProvider.
 */
export function ActivityBar() {
  const { state, dispatch, actions } = useApp();

  /** VSCode rail semantics: clicking the *active* view toggles the
   *  panel collapsed; clicking another view (or any view while
   *  collapsed) opens it on that view. `after` runs the view's
   *  side effect (focus search, open KB overview) only when we land
   *  on it — never on a collapse. */
  function selectView(view: 'files' | 'search' | 'kb', after?: () => void) {
    if (!state.sidebarCollapsed && state.activeSidebarView === view) {
      dispatch({ type: 'SIDEBAR_SET_COLLAPSED', collapsed: true });
      return;
    }
    dispatch({ type: 'SIDEBAR_SET_COLLAPSED', collapsed: false });
    dispatch({ type: 'SIDEBAR_VIEW', view });
    after?.();
  }

  return (
    <nav className="activity-bar" role="tablist" aria-label="Sidebar views">
      <ActivityIcon
        active={!state.sidebarCollapsed && state.activeSidebarView === 'files'}
        controls="sidebar-panel-files"
        label="Files (⌘⇧E)"
        onClick={() => selectView('files')}
      >
        <FilesViewIcon />
      </ActivityIcon>
      <ActivityIcon
        active={!state.sidebarCollapsed && state.activeSidebarView === 'search'}
        controls="sidebar-panel-search"
        label="Search (⌘⇧F)"
        // Focusing the input after the view switch lets ⌘⇧F (and a
        // mouse click) feel the same — both end with the caret in
        // the search box ready for typing.
        onClick={() => selectView('search', () => actions.focusSearch())}
      >
        <SearchIcon />
      </ActivityIcon>
      <ActivityIcon
        active={!state.sidebarCollapsed && state.activeSidebarView === 'kb'}
        controls="sidebar-panel-kb"
        label="Knowledge base (STASHBASE.md)"
        // Auto-open the KB-root overview in the main pane so the user
        // lands on content immediately, not on an empty selection. The
        // KbPanel row also reflects this as its "selected" highlight.
        onClick={() => selectView('kb', () => { void actions.openKbOverview(); })}
      >
        <KbIcon />
      </ActivityIcon>
      {/* Settings pinned to the bottom of the rail, VSCode-style. The
          spacer above (margin-top:auto on this button) pushes it down
          so view toggles stay grouped at the top. */}
      <button
        type="button"
        className="activity-bar-btn activity-bar-btn-bottom"
        onClick={() => openSettings()}
        title="Settings"
      >
        <SettingsIcon />
      </button>
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
