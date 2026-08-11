import { PanelLeftIcon, SearchIcon } from '../icons';
import { formatPrimaryShiftShortcut } from '../platformShortcuts';
import { useApp } from '../store/AppContext';
import { openLibrarySearch } from './LibrarySearch';
import { DeferredTooltipButton } from './DeferredTooltipButton';

const controlButtonClass =
  'flex size-7 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-0 '
  + 'text-muted-foreground hover:bg-muted hover:text-foreground [&_svg]:size-[18px]';

/**
 * Cursor-style window-top controls: sidebar toggle + library search,
 * floating in the titlebar band at the window's top-left (right of the
 * macOS traffic lights — `.titlebar-controls` in globals.css owns the
 * placement). They belong to the APP shell, not the sidebar column, so
 * collapsing the sidebar leaves them in place as the way back in.
 */
export function TitlebarControls() {
  const { state, dispatch } = useApp();
  const collapsed = state.sidebarCollapsed;

  return (
    <div className="titlebar-controls">
      <DeferredTooltipButton
        className={controlButtonClass}
        aria-expanded={!collapsed}
        aria-controls="sidebar-panel-files"
        label={`${collapsed ? 'Show' : 'Hide'} sidebar (${formatPrimaryShiftShortcut('E')})`}
        onClick={() => dispatch({ type: 'SIDEBAR_SET_COLLAPSED', collapsed: !collapsed })}
      >
        <PanelLeftIcon />
      </DeferredTooltipButton>
      <DeferredTooltipButton
        className={controlButtonClass}
        aria-haspopup="dialog"
        label={`Search (${formatPrimaryShiftShortcut('F')})`}
        onClick={() => openLibrarySearch()}
      >
        <SearchIcon />
      </DeferredTooltipButton>
    </div>
  );
}
