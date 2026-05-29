import { useEffect, useLayoutEffect, useRef } from 'react';
import { api } from '../api';
import { useApp } from '../store/AppContext';

/** Drag-import veil. Visibility flows from the global drag handler in
 *  the parent (`useGlobalDragDrop`) via the `hot` prop. */
export function DropVeil({ hot }: { hot: boolean }) {
  return <div className={'drop-veil' + (hot ? ' hot' : '')}>Release to import</div>;
}

/**
 * Right-click menu on file / folder rows. Rendered at cursor position
 * when `state.ctxMenu` is set; dismisses on click-outside, Escape, or
 * window blur.
 */
export function ContextMenu() {
  const { state, dispatch, actions } = useApp();
  const ref = useRef<HTMLDivElement | null>(null);

  // Clamp menu against viewport so it doesn't overflow when right-
  // clicking near the bottom-right corner.
  useLayoutEffect(() => {
    if (!state.ctxMenu || !ref.current) return;
    const el = ref.current;
    const { width, height } = el.getBoundingClientRect();
    const maxX = window.innerWidth - width - 4;
    const maxY = window.innerHeight - height - 4;
    el.style.left = Math.min(state.ctxMenu.x, maxX) + 'px';
    el.style.top = Math.min(state.ctxMenu.y, maxY) + 'px';
  }, [state.ctxMenu]);

  useEffect(() => {
    if (!state.ctxMenu) return;
    function onMouseDown(e: MouseEvent) {
      if (!ref.current || ref.current.contains(e.target as Node)) return;
      dispatch({ type: 'CTX_MENU', menu: null });
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') dispatch({ type: 'CTX_MENU', menu: null });
    }
    function onBlur() { dispatch({ type: 'CTX_MENU', menu: null }); }
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('blur', onBlur);
    };
  }, [state.ctxMenu, dispatch]);

  if (!state.ctxMenu) return null;
  const { target, kind } = state.ctxMenu;
  // "Retry conversion" is only meaningful when the target is a PDF
  // currently in the failures list. Showing it on every PDF would let
  // the user nuke + re-convert a working file by accident — the route
  // deletes the derived `.<stem>.md` / `_files/` before re-running.
  const canRetryPdf =
    kind === 'file' && /\.pdf$/i.test(target) && state.pdfFailures.some((f) => f.path === target);

  type CtxAction = 'rename' | 'delete' | 'reveal' | 'retry-pdf';
  function dispatchAction(action: CtxAction) {
    dispatch({ type: 'CTX_MENU', menu: null });
    if (action === 'rename') {
      dispatch({ type: 'RENAMING', renaming: { path: target, kind } });
    } else if (action === 'delete') {
      if (kind === 'folder') void actions.deleteFolder(target);
      else void actions.deleteFile(target);
    } else if (action === 'reveal') {
      void api.revealFile(target);
    } else if (action === 'retry-pdf') {
      // Fire-and-forget — the failures-list / banner update on the next
      // index-status poll (~1.5s in pending mode). If the API itself
      // 4xx's we log; user-facing feedback comes via that banner
      // flipping `failed` → in-flight → done.
      void api.retryPdf(target).catch((err) => {
        console.warn('[ctxmenu] retry pdf failed:', err instanceof Error ? err.message : String(err));
      });
    }
  }

  // Each item is `role="menuitem"` with explicit keyboard handling so
  // arrow-key + Enter / Space activation works even though we render as
  // div (not button) — the existing `.ctx-item` styling assumes block
  // semantics, and reskinning a native button to match would just
  // duplicate every rule.
  function itemKeyDown(action: CtxAction) {
    return (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        dispatchAction(action);
      }
    };
  }
  return (
    <div className="ctx-menu" ref={ref} style={{ position: 'fixed' }} role="menu">
      <div
        className="ctx-item"
        role="menuitem"
        tabIndex={0}
        onClick={() => dispatchAction('rename')}
        onKeyDown={itemKeyDown('rename')}
      >Rename…</div>
      <div
        className="ctx-item"
        role="menuitem"
        tabIndex={0}
        onClick={() => dispatchAction('reveal')}
        onKeyDown={itemKeyDown('reveal')}
      >{revealLabel()}</div>
      {canRetryPdf && (
        <div
          className="ctx-item"
          role="menuitem"
          tabIndex={0}
          onClick={() => dispatchAction('retry-pdf')}
          onKeyDown={itemKeyDown('retry-pdf')}
          title="Re-run the PDF converter — clears the derived note and bundle"
        >Retry conversion</div>
      )}
      <div
        className="ctx-item danger"
        role="menuitem"
        tabIndex={0}
        onClick={() => dispatchAction('delete')}
        onKeyDown={itemKeyDown('delete')}
      >Delete</div>
    </div>
  );
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
