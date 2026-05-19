import { useApp } from '../store/AppContext';

/**
 * Obsidian-style centered path strip. Segments are the path relative to
 * the space root, with the trailing markdown / html extension stripped
 * from the last segment. Separators are muted; the final segment uses
 * the normal foreground to mark "you are here".
 *
 * Each segment is clickable:
 *  - Filename segment → focus the file row in the sidebar (the file is
 *    already open in this tab, so this is purely a sidebar nudge).
 *  - Folder segment → set that folder as `activeFolder` (creation anchor)
 *    AND `selectedPath` (sidebar focus), then scroll its row into view.
 *
 * Ancestor folders are expanded along the way so the target row is
 * actually in the DOM when we scroll to it.
 *
 * NOTE: this is the one place we still reach into the sidebar's DOM
 * (querySelector by `data-path`) — the relationship is genuinely
 * indirect (main pane → sidebar tree row), and registering every row's
 * ref into the store would be heavy. If a second cross-pane scroll
 * use-case appears, lift this into a shared store action.
 */
export function PathBreadcrumb({ name }: { name: string }) {
  const { state, dispatch } = useApp();
  const rawSegs = name.split('/');
  const display = rawSegs.slice();
  const last = display.length - 1;
  display[last] = display[last].replace(/\.(md|markdown|html|htm)$/i, '');

  function ensureVisible(targetPath: string) {
    if (state.spaceCollapsed) dispatch({ type: 'SPACE_FOLD_TOGGLE' });
    const parts = targetPath.split('/');
    for (let i = 1; i < parts.length; i++) {
      dispatch({ type: 'EXPAND_FOLDER', path: parts.slice(0, i).join('/') });
    }
    requestAnimationFrame(() => {
      const sel = `.sidebar [data-path="${CSS.escape(targetPath)}"]`;
      document.querySelector(sel)?.scrollIntoView({ block: 'nearest' });
    });
  }

  function onSegClick(i: number) {
    if (i === last) {
      dispatch({ type: 'SELECT_PATH', path: name });
      ensureVisible(name);
    } else {
      const folderPath = rawSegs.slice(0, i + 1).join('/');
      dispatch({ type: 'ACTIVE_FOLDER', path: folderPath });
      ensureVisible(folderPath);
    }
  }

  return (
    <div className="main-breadcrumb" title={name}>
      {display.map((s, i) => (
        <span key={i}>
          {i > 0 && <span className="sep"> / </span>}
          <button
            type="button"
            className={i === last ? 'seg current' : 'seg'}
            onClick={() => onSegClick(i)}
          >
            {s}
          </button>
        </span>
      ))}
    </div>
  );
}
