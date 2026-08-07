import { FilesViewIcon, SearchIcon, SettingsIcon } from '../icons';
import { formatPrimaryShiftShortcut } from '../platformShortcuts';
import { useApp } from '../store/AppContext';
import { openSettings } from './SettingsModal';
import { DeferredTooltipButton } from './DeferredTooltipButton';

/**
 * Narrow left rail (à la VS Code / Obsidian) holding one icon per
 * sidebar view. Two mutually-exclusive views:
 *
 *   - files   → folder-home files + folder-scoped tree
 *   - search  → search input + result list
 *
 * Exactly one icon is "active" at a time — the active state is bound
 * to `state.activeSidebarView`, NOT to whatever happens to be focused
 * in the main pane, so the bar always reads as "what view am I in".
 * The view is NOT persisted across launches — every relaunch lands on
 * Files (the canonical landing spot; Search is entered on demand).
 */
/* VS Code / Obsidian-style narrow icon rail. Hover state lives on the
 * individual buttons; the rail itself is a flat background so it reads
 * as part of the chrome, not as a separate panel. The active indicator
 * is a 2px accent strip on the button's left edge. */
const railButtonClass =
  'relative flex h-10 w-11 cursor-pointer items-center justify-center border-0 bg-transparent p-0 '
  + 'text-muted-foreground hover:bg-muted hover:text-foreground [&_svg]:size-[18px]';

const railActiveClass =
  " text-foreground before:absolute before:top-1.5 before:bottom-1.5 before:left-0 before:w-0.5"
  + " before:rounded-r-xs before:bg-accent before:content-['']";

export function ActivityBar() {
  const { state, dispatch, actions } = useApp();

  /** VSCode rail semantics: clicking the *active* view toggles the
   *  panel collapsed; clicking another view (or any view while
   *  collapsed) opens it on that view. `after` runs the view's
   *  side effect (e.g. focus search) only when we land on it — never
   *  on a collapse. */
  function selectView(view: 'files' | 'search', after?: () => void) {
    if (!state.sidebarCollapsed && state.activeSidebarView === view) {
      dispatch({ type: 'SIDEBAR_SET_COLLAPSED', collapsed: true });
      return;
    }
    dispatch({ type: 'SIDEBAR_SET_COLLAPSED', collapsed: false });
    dispatch({ type: 'SIDEBAR_VIEW', view });
    after?.();
  }

  return (
    <nav
      className="flex w-11 flex-none flex-col items-stretch gap-0.5 border-r border-border bg-pane py-1"
      role="tablist"
      aria-label="Sidebar views"
    >
      <ActivityIcon
        active={!state.sidebarCollapsed && state.activeSidebarView === 'files'}
        controls="sidebar-panel-files"
        label={`Files (${formatPrimaryShiftShortcut('E')})`}
        onClick={() => selectView('files')}
      >
        <FilesViewIcon />
      </ActivityIcon>
      <ActivityIcon
        active={!state.sidebarCollapsed && state.activeSidebarView === 'search'}
        controls="sidebar-panel-search"
        label={`Search (${formatPrimaryShiftShortcut('F')})`}
        // Focusing the input after the view switch lets ⌘⇧F (and a
        // mouse click) feel the same — both end with the caret in
        // the search box ready for typing.
        onClick={() => selectView('search', () => actions.focusSearch())}
      >
        <SearchIcon />
      </ActivityIcon>
      {/* Settings pinned to the bottom of the rail, VSCode-style. The
          spacer above (margin-top:auto on this button) pushes it down
          so view toggles stay grouped at the top. */}
      <DeferredTooltipButton
        className={railButtonClass + ' mt-auto'}
        label="Settings"
        onClick={() => openSettings()}
      >
        <SettingsIcon />
      </DeferredTooltipButton>
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
    <DeferredTooltipButton
      className={railButtonClass + (active ? railActiveClass : '')}
      role="tab"
      aria-selected={active}
      aria-controls={controls}
      label={label}
      onClick={onClick}
    >
      {children}
    </DeferredTooltipButton>
  );
}
