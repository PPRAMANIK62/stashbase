import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { assetBaseUrl } from '../api';
import { extractHeadings, renderMarkdown, withScrollBootstrap } from '../markdown';
import { useApp } from '../store/AppContext';
import { CodeEditor } from './CodeEditor';

/**
 * Two-pane source+preview for both MD and HTML. Edits debounce-update
 * the right pane (~80ms — below perceptual threshold but spares
 * re-renders on every keystroke). MD edits also push live heading
 * extraction into the store so the Outline reflects the in-progress
 * buffer without waiting for autosave.
 *
 * Initial content for the editor comes from the open file's "last
 * saved" baseline. The editor owns the live buffer thereafter; preview
 * follows.
 */
export function Split({
  name,
  format,
  initialContent,
}: {
  name: string;
  format: 'md' | 'html';
  initialContent: string;
}) {
  const { actions, activeTab } = useApp();
  const pendingAnchor = activeTab?.pendingAnchor ?? null;
  // The preview source updates after a small debounce. We keep it in
  // local state so React handles the iframe diff for us (changing the
  // `srcDoc` prop replaces the iframe doc; changing `src` triggers a
  // full navigation — we revoke + recreate a blob URL for HTML to keep
  // the scroll position stable).
  const [previewSource, setPreviewSource] = useState(initialContent);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const previewFrameRef = useRef<HTMLIFrameElement | null>(null);
  // What the iframe finished parsing last. Pending scroll only applies
  // when this matches the current preview html (avoid scrolling on a
  // stale doc during file-switch reloads).
  const loadedHtmlRef = useRef<string>('');

  // Reset preview when the file switches.
  useEffect(() => {
    setPreviewSource(initialContent);
  }, [name, initialContent]);

  // Cleanup blob URLs on unmount and when source changes.
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  const previewHtml = useMemo(() => {
    if (format === 'md') return withHtmlAssetBase(renderMarkdown(previewSource), assetBaseUrl(name));
    return withHtmlAssetBase(withScrollBootstrap(previewSource), assetBaseUrl(name));
  }, [previewSource, format, name]);

  // HTML preview is driven by a blob URL so the live buffer can render
  // without round-tripping through disk. `withHtmlAssetBase` points
  // relative refs at the saved file's directory, matching read-only
  // preview behavior for sidecar images / CSS / fonts.
  const iframeProps =
    format === 'html'
      ? (() => {
          if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
          blobUrlRef.current = URL.createObjectURL(
            new Blob([previewHtml], { type: 'text/html' }),
          );
          return { src: blobUrlRef.current };
        })()
      : { srcDoc: previewHtml };

  function onEditorChange(doc: string) {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(() => setPreviewSource(doc), 80);
    actions.scheduleSave();
    if (format === 'md') {
      actions.setOutlineHeadings(extractHeadings(doc));
    }
  }

  const applyPendingScroll = useCallback(() => {
    if (!pendingAnchor) return;
    if (format === 'md') {
      const doc = previewFrameRef.current?.contentDocument;
      const el = doc?.getElementById(pendingAnchor);
      if (el) el.scrollIntoView({ behavior: 'auto', block: 'start' });
    } else {
      try {
        previewFrameRef.current?.contentWindow?.postMessage(
          { type: 'stashbase-scroll', id: pendingAnchor },
          '*',
        );
      } catch { /* swallow */ }
    }
    actions.consumePendingScroll();
  }, [pendingAnchor, format, actions]);

  // Pending anchor without an iframe reload (same-file jumps).
  useEffect(() => {
    if (!pendingAnchor) return;
    if (loadedHtmlRef.current !== previewHtml) return; // wait for onLoad
    applyPendingScroll();
  }, [pendingAnchor, previewHtml, applyPendingScroll]);

  // Imperative `load` listener — React's onLoad on srcDoc iframes
  // misfires in some environments, leaving the click handler unbound.
  // For HTML format (cross-origin sandbox), parent can't reach the
  // contentDocument anyway; the in-iframe bootstrap handles clicks.
  useEffect(() => {
    if (format !== 'md') return;
    const iframe = previewFrameRef.current;
    if (!iframe) return;
    let installedDoc: Document | null = null;

    function clickHandler(e: Event) {
      // Cross-realm duck-typing (see MarkdownPreview for context).
      const target = e.target as (Element & { closest?: typeof Element.prototype.closest }) | null;
      if (!target || typeof target.closest !== 'function') return;
      const img = target.closest('img') as HTMLImageElement | null;
      if (img) {
        const src = img.currentSrc || img.src;
        if (!src) return;
        e.preventDefault();
        window.postMessage({
          type: 'stashbase-preview-image',
          src,
          alt: img.alt || '',
        }, window.location.origin);
        return;
      }
      const anchor = target.closest('a') as HTMLAnchorElement | null;
      if (anchor) forwardAnchorClick(anchor, e);
    }

    function attach() {
      const doc = iframe?.contentDocument;
      if (!doc || installedDoc === doc) return;
      installedDoc = doc;
      for (const img of Array.from(doc.images)) {
        img.dataset.stashbasePreviewable = 'true';
      }
      doc.addEventListener('click', clickHandler);
      loadedHtmlRef.current = previewHtml;
      applyPendingScroll();
    }

    iframe.addEventListener('load', attach);
    if (iframe.contentDocument?.readyState === 'complete') attach();
    return () => {
      iframe.removeEventListener('load', attach);
      installedDoc?.removeEventListener('click', clickHandler);
    };
  }, [previewHtml, format, applyPendingScroll]);

  return (
    <div className="split">
      <div className="split-source">
        <CodeEditor
          // Re-mount on file/format change so CM picks up the new
          // initial content cleanly without any state migration.
          key={`${name}|${format}`}
          initialContent={initialContent}
          format={format}
          onChange={onEditorChange}
        />
      </div>
      <div className="split-preview">
        <iframe
          ref={previewFrameRef}
          id="previewFrame"
          className="html-viewer"
          sandbox={format === 'html' ? 'allow-scripts' : 'allow-same-origin'}
          {...iframeProps}
          title="Preview"
        />
      </div>
    </div>
  );
}

/** Mirror of MarkdownPreview's click handler for the edit-mode MD
 *  preview: forward cross-file `.md/.html` links + external links to
 *  the parent, leave `#anchor` to the same-origin browser. */
function forwardAnchorClick(anchor: HTMLAnchorElement, e: Event) {
  const raw = anchor.getAttribute('href');
  if (!raw || raw.startsWith('#')) return;
  let url: URL;
  try { url = new URL(anchor.href, window.location.href); } catch { return; }
  if (url.origin === window.location.origin && url.pathname.startsWith('/asset/')) {
    const encoded = url.pathname.slice('/asset/'.length);
    let decoded: string;
    try {
      decoded = encoded.split('/').map(decodeURIComponent).join('/');
    } catch { return; }
    if (!/\.(md|markdown|html|htm)$/i.test(decoded)) return;
    e.preventDefault();
    const hash = url.hash.startsWith('#') ? url.hash.slice(1) : '';
    window.postMessage({
      type: 'stashbase-nav',
      path: decoded,
      anchor: hash || undefined,
    }, window.location.origin);
    return;
  }
  if (url.protocol === 'http:' || url.protocol === 'https:') {
    e.preventDefault();
    window.postMessage({ type: 'stashbase-open-external', href: url.href }, window.location.origin);
  }
}

function withHtmlAssetBase(html: string, baseHref: string): string {
  if (/<base\b/i.test(html)) return html;
  const tag = `<base href="${escapeAttr(baseHref)}">`;
  if (/<head\b[^>]*>/i.test(html)) {
    return html.replace(/<head\b[^>]*>/i, (m) => m + tag);
  }
  if (/^\s*<!doctype\b[^>]*>/i.test(html)) {
    return html.replace(/^(\s*<!doctype\b[^>]*>)/i, `$1<head>${tag}</head>`);
  }
  return `<head>${tag}</head>` + html;
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
