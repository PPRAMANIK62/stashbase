import { api } from '../api';
import { useApp } from '../store/AppContext';
import { Menu, type MenuItem } from './Menu';

/** Drag-import veil. Visibility flows from the global drag handler in
 *  the parent (`useGlobalDragDrop`) via the `hot` prop. */
export function DropVeil({ hot }: { hot: boolean }) {
  return <div className={'drop-veil' + (hot ? ' hot' : '')}>Release to import</div>;
}

/**
 * Right-click menu on file / folder rows. Rendered at cursor position
 * when `state.ctxMenu` is set. Positioning, dismissal (click-outside /
 * Escape / blur) and keyboard nav all live in the shared `<Menu>`.
 */
export function ContextMenu() {
  const { state, dispatch, actions } = useApp();
  if (!state.ctxMenu) return null;
  const { x, y, target, kind } = state.ctxMenu;
  const close = () => dispatch({ type: 'CTX_MENU', menu: null });

  // "Retry conversion" is only meaningful when the target is a PDF
  // currently in the failures list. Showing it on every PDF would let
  // the user nuke + re-convert a working file by accident — the route
  // deletes the derived `.<stem>.md` / `_files/` before re-running.
  const canRetryPdf =
    kind === 'file' && /\.pdf$/i.test(target) && state.pdfFailures.some((f) => f.path === target);

  const items: MenuItem[] = [
    {
      label: 'Rename…',
      onSelect: () => dispatch({ type: 'RENAMING', renaming: { path: target, kind } }),
    },
    { label: revealLabel(), onSelect: () => void api.revealFile(target) },
    ...(canRetryPdf
      ? [
          {
            label: 'Retry conversion',
            title: 'Re-run the PDF converter — clears the derived note and bundle',
            // Fire-and-forget — the failures-list / banner update on the
            // next index-status poll (~1.5s in pending mode). If the API
            // itself 4xx's we log; user-facing feedback comes via that
            // banner flipping `failed` → in-flight → done.
            onSelect: () =>
              void api.retryPdf(target).catch((err) => {
                console.warn('[ctxmenu] retry pdf failed:', err instanceof Error ? err.message : String(err));
              }),
          } satisfies MenuItem,
        ]
      : []),
    { separator: true },
    {
      label: 'Delete',
      danger: true,
      onSelect: () => (kind === 'folder' ? void actions.deleteFolder(target) : void actions.deleteFile(target)),
    },
  ];

  return <Menu anchor={{ x, y }} items={items} onClose={close} />;
}

/** OS-appropriate label for the reveal-in-file-manager action. macOS
 *  users expect "Finder"; Windows users expect "Explorer"; other
 *  platforms fall back to the generic "File Manager". */
function revealLabel(): string {
  const p = (navigator.platform || '').toLowerCase();
  if (p.includes('mac')) return 'Reveal in Finder';
  if (p.includes('win')) return 'Reveal in Explorer';
  return 'Show in File Manager';
}
