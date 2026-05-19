import { useApp } from '../store/AppContext';

/**
 * Tab strip at the top of the main pane — one chip per open tab plus a
 * `+` button. Left-click activates, `×` (or middle-click) closes, `+`
 * pushes an empty tab (Obsidian-style). The active tab gets a stronger
 * background; inactive tabs are muted; long names ellipsize.
 *
 * Preview tabs (single-click in the sidebar) render their label
 * italic. Double-clicking the tab title promotes it to pinned — same
 * convention as VS Code's preview tabs.
 *
 * All state mutations route through `AppContext` actions / dispatch —
 * this component just renders.
 */
export function TabStrip() {
  const { state, actions, dispatch } = useApp();
  return (
    <div className="tab-strip">
      <div className="tab-strip-inner">
        {state.tabs.map((t) => {
          const isActive = t.id === state.activeTabId;
          const label = t.file ? displayBasename(t.file.name) : 'Untitled';
          const cls = 'tab'
            + (isActive ? ' active' : '')
            + (t.preview ? ' preview' : '');
          return (
            <div
              key={t.id}
              className={cls}
              title={
                (t.file?.name ?? 'Empty tab')
                + (t.preview ? '  (preview — double-click to keep)' : '')
              }
              onClick={() => { void actions.activateTab(t.id); }}
              onDoubleClick={(e) => {
                e.preventDefault();
                // Double-click on a preview tab pins it. No-op on
                // already-pinned tabs (the action layer guards too).
                if (t.preview) dispatch({ type: 'PROMOTE_TAB', id: t.id });
              }}
              onAuxClick={(e) => {
                // Middle-click closes — matches browser tab behavior.
                if (e.button === 1) {
                  e.preventDefault();
                  void actions.closeTab(t.id);
                }
              }}
            >
              <span className="tab-label">{label}</span>
              <button
                type="button"
                className="tab-close"
                title="Close tab"
                onClick={(e) => {
                  e.stopPropagation();
                  void actions.closeTab(t.id);
                }}
              >×</button>
            </div>
          );
        })}
        <button
          type="button"
          className="tab-new"
          title="New tab"
          onClick={() => { void actions.newTab(); }}
        >+</button>
      </div>
    </div>
  );
}

function displayBasename(path: string): string {
  const base = path.split('/').pop() ?? path;
  return base.replace(/\.(md|markdown|html|htm)$/i, '');
}
