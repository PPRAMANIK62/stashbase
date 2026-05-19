import { useEffect, useMemo, useRef } from 'react';
import { assetUrl } from '../api';
import { useApp } from '../store/AppContext';

/**
 * Read-only HTML preview. Loads via `/asset/*` so the iframe's base
 * resolves relative references in the page (`<img src="X_files/foo.png">`)
 * to the sibling files inside the space dir.
 *
 * Sandbox = `allow-scripts` only (no same-origin) — pages we accept
 * may include inline scripts that fill in templated views (Wikipedia
 * snapshots, arxiv reports). The server-injected scroll-bootstrap
 * listens for postMessage from the parent (anchor scroll + cross-file
 * link forwarding).
 *
 * Auto-reload on external edits (Claude Code edits the file from the
 * terminal panel) is the reason for the cache-buster query string on
 * the iframe src — the URL would otherwise be identical between
 * versions and React would never re-set it, leaving the iframe
 * stuck on whatever the asset route served first. See the `src`
 * computation below.
 */
export function HtmlPreview({ name }: { name: string }) {
  const { actions, activeTab } = useApp();
  const pendingAnchor = activeTab?.pendingAnchor ?? null;
  const content = activeTab?.file?.content ?? '';
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  // Tracks which `name` the iframe has finished loading. We only post
  // the scroll message when this matches the current `name` — otherwise
  // the message lands on the previous file's content and the pending
  // anchor gets consumed before the new content arrives.
  const loadedNameRef = useRef<string>('');

  // Cheap content fingerprint used to bust the iframe cache when the
  // file changes on disk (e.g. Claude Code wrote to it via the
  // terminal panel; `refreshActiveTabFromDisk` patched our local
  // state but the iframe is fed by `assetUrl(name)` which the server
  // re-reads from disk on every request — without a query-string
  // change React keeps the same `src`, so the iframe never refetches).
  // djb2 over the whole content; usable as a 32-bit base36 token.
  const fingerprint = useMemo(() => {
    let h = 5381;
    for (let i = 0; i < content.length; i++) {
      h = ((h << 5) + h + content.charCodeAt(i)) | 0;
    }
    return (h >>> 0).toString(36);
  }, [content]);
  const src = `${assetUrl(name)}?v=${fingerprint}`;

  function postScroll() {
    if (!pendingAnchor) return;
    if (loadedNameRef.current !== name) return; // iframe still loading
    try {
      frameRef.current?.contentWindow?.postMessage(
        { type: 'stashbase-scroll', id: pendingAnchor },
        '*',
      );
    } catch { /* swallow */ }
    actions.consumePendingScroll();
  }

  function onLoad() {
    loadedNameRef.current = name;
    postScroll();
  }

  // Same-file anchor jumps fire this; cross-file jumps wait for onLoad.
  useEffect(() => { postScroll(); /* eslint-disable-next-line */ }, [pendingAnchor, name]);

  return (
    <div className="viewer-shell">
      <iframe
        ref={frameRef}
        id="previewFrame"
        className="html-viewer"
        sandbox="allow-scripts"
        src={src}
        title="HTML preview"
        onLoad={onLoad}
      />
    </div>
  );
}
