import { useEffect, useMemo, useRef } from 'react';
import { assetBaseUrl } from '../api';
import { renderMarkdown } from '../markdown';
import { useApp } from '../store/AppContext';
import { injectAssetBase, previewClickHandler } from '../lib/previewIframe';
import { makeIframeFindController } from './findIframe';
import { useIframeDropForward } from '../hooks/useIframeDropForward';
import { applyChunkHighlight } from './previewChunkHighlight';

/**
 * Read-only MD preview. Renders the markdown to a self-contained HTML
 * document and feeds it to the iframe via `srcDoc`. Sandbox is
 * `allow-same-origin` (no scripts) so the parent can hash-nav into it
 * for in-doc anchor links AND directly intercept `<a>` / `<img>` events.
 *
 * The iframe id `previewFrame` is shared with HtmlPreview and the
 * split-edit iframe — anchor scrolls pick whichever exists.
 */
export function MarkdownPreview({ name, content }: { name: string; content: string }) {
  const { state, actions, activeTab } = useApp();
  const pendingAnchor = activeTab?.pendingAnchor ?? null;
  const pendingHighlight = activeTab?.pendingHighlight ?? null;
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  // Snapshot find-bar state for the mount-time re-apply path. Read via
  // ref so the registration effect doesn't churn on every find tick.
  const findAtMount = useRef(state.find);
  findAtMount.current = state.find;
  // Tracks the html the iframe has finished parsing. We only apply
  // pending scroll when this matches the latest `html` — otherwise
  // we'd read elements from the stale doc and either scroll to the
  // wrong place or consume the pending intent prematurely.
  const loadedHtmlRef = useRef<string>('');
  const html = useMemo(() => {
    const rendered = renderMarkdown(content);
    return injectAssetBase(rendered, assetBaseUrl(name));
  }, [name, content]);

  // Imperative attach: React's `onLoad` prop on a `srcDoc` iframe is
  // unreliable across srcDoc swaps (in some environments it never
  // fires after the first load). Hook the iframe's native `load`
  // event each time `html` changes; also cover the race where the
  // doc is already parsed before this effect runs.
  useEffect(() => {
    const iframe = frameRef.current;
    if (!iframe) return;
    let installedDoc: Document | null = null;

    // Cmd+F in the iframe should pop OUR find bar instead of falling
    // through to the browser's default. The parent reaches in directly
    // because sandbox=allow-same-origin keeps the realm accessible.
    function findKeyHandler(e: Event) {
      const ke = e as KeyboardEvent;
      if (!(ke.metaKey || ke.ctrlKey)) return;
      const k = ke.key.toLowerCase();
      if (k === 'f') { ke.preventDefault(); actions.openFind(); }
      else if (k === 'g') {
        ke.preventDefault();
        if (ke.shiftKey) actions.findPrev(); else actions.findNext();
      }
    }

    function handleClick(e: Event) {
      previewClickHandler(e, name);
    }

    function attach() {
      const doc = iframe?.contentDocument;
      if (!doc || installedDoc === doc) return;
      installedDoc = doc;
      for (const img of Array.from(doc.images)) {
        img.dataset.stashbasePreviewable = 'true';
      }
      doc.addEventListener('click', handleClick);
      doc.addEventListener('keydown', findKeyHandler);
      loadedHtmlRef.current = html;
      applyPendingScroll(doc);
      // If the find bar is open across the content reload, re-paint
      // the highlights against the freshly parsed body.
      const snap = findAtMount.current;
      if (snap.open && snap.query) {
        // Schedule async so the controller (registered in a sibling
        // effect) is in place before we re-apply.
        queueMicrotask(() => actions.setFindQuery(snap.query));
      }
    }

    iframe.addEventListener('load', attach);
    if (iframe.contentDocument?.readyState === 'complete') attach();
    return () => {
      iframe.removeEventListener('load', attach);
      installedDoc?.removeEventListener('click', handleClick);
      installedDoc?.removeEventListener('keydown', findKeyHandler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html]);

  // OS-file drops over the preview relay out to useGlobalDragDrop.
  useIframeDropForward(frameRef, html);

  // Register the find controller once per mount. Reads the live
  // contentDocument on each call so it survives srcDoc reloads
  // without re-registering.
  useEffect(() => {
    const ctl = makeIframeFindController(
      () => frameRef.current?.contentDocument ?? null,
      () => frameRef.current?.contentWindow ?? null,
    );
    actions.registerFindController(ctl);
    return () => { actions.registerFindController(null); };
  }, [actions]);

  // Same-file anchor jump (no iframe reload): the loaded ref still
  // matches `html`, so the gate below lets us scroll synchronously.
  useEffect(() => {
    if (!pendingAnchor) return;
    if (loadedHtmlRef.current !== html) return; // iframe still loading
    const doc = frameRef.current?.contentDocument;
    if (doc) applyPendingScroll(doc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAnchor, html]);

  // Chunk-highlight after a SearchHit click. allow-same-origin lets
  // us walk the iframe DOM from the parent directly — no postMessage
  // needed (unlike HtmlPreview, which has to route through the
  // injected bootstrap because the HTML iframe is fully sandboxed).
  useEffect(() => {
    if (!pendingHighlight) return;
    if (loadedHtmlRef.current !== html) return;
    const doc = frameRef.current?.contentDocument;
    if (!doc) return;
    if (applyChunkHighlight(doc, pendingHighlight.chunkText)) {
      actions.consumePendingHighlight();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingHighlight, html]);

  function applyPendingScroll(doc: Document) {
    if (!pendingAnchor) return;
    const el = doc.getElementById(pendingAnchor);
    if (el) {
      el.scrollIntoView({ behavior: 'auto', block: 'start' });
    }
    actions.consumePendingScroll();
  }

  return (
    <div className="viewer-shell">
      <iframe
        ref={frameRef}
        id="previewFrame"
        className="html-viewer"
        sandbox="allow-same-origin"
        srcDoc={html}
        title="Markdown preview"
      />
    </div>
  );
}
