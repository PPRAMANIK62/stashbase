/**
 * HTML → viewer-ready markup + outline + indexable plaintext.
 *
 * One lightweight tokenizer pass walks heading blocks in document order:
 *   - heading elements (h1..h6) become section boundaries AND get a
 *     stable `id="h-<N>"` injected so the iframe viewer can scroll to
 *     them via postMessage.
 *   - text between consecutive headings becomes that section's body,
 *     stripped to plaintext for indexing.
 *
 * Chunking is **no longer done here** — that's MFS's job. We emit
 * `plaintext` shaped like markdown (`# Heading\n\nbody…`) so MFS's
 * markdown chunker keeps respecting our heading boundaries even though
 * it doesn't natively parse HTML.
 */

export interface Heading {
  level: number;          // 1-6
  text: string;
  id: string;             // matches the id attribute injected on the element
}

export interface HtmlAnalysis {
  headings: Heading[];
  /** Original HTML with `id="h-<N>"` attrs injected on each heading.
   *  This is what the iframe viewer renders. */
  preparedHtml: string;
  /** Markdown-shaped plaintext of the doc (`# heading\n\nbody…`). Fed
   *  to MFS for chunking + embedding; preserves heading boundaries. */
  plaintext: string;
}

export function analyzeHtml(html: string): HtmlAnalysis {
  // Single combined regex walks heading opening tags + skips
  // non-indexable blocks (script/style/noscript/template) in one pass,
  // so we know each heading's character offset and can also rewrite
  // its opening tag with `id="h-<N>"` for the iframe viewer.
  const tokenRe = /<(script|style|noscript|template)\b[\s\S]*?<\/\1\s*>|<h([1-6])\b([^>]*)>([\s\S]*?)<\/h\2\s*>/gi;

  const headings: Heading[] = [];
  const preparedParts: string[] = [];           // accumulated rewritten HTML
  const indexableSegments: string[] = [];       // text segments to flatten for plaintext
  const plaintextParts: string[] = [];
  let preparedCursor = 0;
  let indexableCursor = 0;
  // Build the "indexable" version (HTML minus script/style/...) and the
  // "prepared" version (HTML with heading ids injected) simultaneously.
  // For plaintext we want indexable; for preparedHtml we want the
  // original markup with ids added.
  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(html))) {
    const [, skipTag, level, attrs, headingInner] = m;
    if (skipTag) {
      // Non-indexable block — keep verbatim in preparedHtml, drop from
      // plaintext input.
      preparedParts.push(html.slice(preparedCursor, m.index + m[0].length));
      preparedCursor = m.index + m[0].length;
      indexableSegments.push(html.slice(indexableCursor, m.index));
      indexableCursor = m.index + m[0].length;
      continue;
    }
    // Body before this heading goes into plaintext as flowing text.
    indexableSegments.push(html.slice(indexableCursor, m.index));
    const bodyText = collapseWhitespace(htmlToText(indexableSegments.join('')));
    indexableSegments.length = 0;
    if (bodyText) plaintextParts.push(bodyText, '');

    const lvl = Number(level);
    const headingText = collapseWhitespace(htmlToText(headingInner));
    const id = `h-${headings.length}`;
    headings.push({ level: lvl, text: headingText, id });
    plaintextParts.push(`${'#'.repeat(lvl)} ${headingText}`, '');

    // Rewrite the opening tag with `id="h-N"` in preparedHtml. The
    // heading inner + closing tag pass through unchanged.
    const cleanAttrs = (attrs ?? '').replace(/\s+id\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i, '');
    preparedParts.push(html.slice(preparedCursor, m.index));
    preparedParts.push(`<h${lvl}${cleanAttrs} id="${id}">`);
    preparedCursor = m.index + `<h${lvl}${attrs}>`.length;
    // Restart the indexable cursor right after the heading element
    // (we consume the inner via headingText, not as body).
    indexableCursor = m.index + m[0].length;
  }
  // Tail: remaining body for plaintext + remaining markup for preparedHtml.
  indexableSegments.push(html.slice(indexableCursor));
  const tailText = collapseWhitespace(htmlToText(indexableSegments.join('')));
  if (tailText) plaintextParts.push(tailText);
  preparedParts.push(html.slice(preparedCursor));

  return {
    headings,
    preparedHtml: addScrollBootstrap(preparedParts.join('')),
    plaintext: plaintextParts.join('\n').trim(),
  };
}

function addScrollBootstrap(html: string): string {
  // The iframe viewer uses `sandbox="allow-scripts"` without
  // `allow-same-origin`. That lets dynamic HTML render while preventing
  // the document from escaping its sandbox, but it also means the parent
  // cannot set `location.hash` directly. This tiny trusted listener gives
  // the sidebar outline a safe scroll target. External links are also
  // forwarded to the parent: otherwise a YouTube/GitHub/etc link
  // navigates the sandboxed iframe and often renders as a blank page.
  const script = `<script>
window.addEventListener('message', function(e) {
  if (!e || !e.data || e.data.type !== 'stashbase-scroll') return;
  var el = document.getElementById(e.data.id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
document.addEventListener('click', function(e) {
  var node = e.target;
  while (node && node.tagName !== 'A' && node.tagName !== 'IMG') node = node.parentElement;
  if (!node) return;
  if (node.tagName === 'IMG') {
    var src = node.currentSrc || node.getAttribute('src');
    if (!src) return;
    try {
      e.preventDefault();
      window.parent.postMessage({
        type: 'stashbase-preview-image',
        src: new URL(src, document.baseURI).href,
        alt: node.getAttribute('alt') || ''
      }, '*');
    } catch (_) {}
    return;
  }
  var raw = node.getAttribute('href');
  if (!raw || raw.charAt(0) === '#') return;
  try {
    var url = new URL(raw, document.baseURI);
    // Same-origin /asset/ links to .md / .html files = cross-file
    // navigation inside the space. Hand off to the parent so the
    // back/forward stack records the jump.
    if (url.origin === location.origin && url.pathname.indexOf('/asset/') === 0) {
      var encoded = url.pathname.slice('/asset/'.length);
      var decoded;
      try {
        decoded = encoded.split('/').map(decodeURIComponent).join('/');
      } catch (_) { return; }
      if (/\\.(md|markdown|html|htm)$/i.test(decoded)) {
        e.preventDefault();
        var anchor = url.hash && url.hash.charAt(0) === '#' ? url.hash.slice(1) : '';
        window.parent.postMessage({
          type: 'stashbase-nav',
          path: decoded,
          anchor: anchor || undefined
        }, '*');
        return;
      }
    }
    if ((url.protocol === 'http:' || url.protocol === 'https:') && url.origin !== location.origin) {
      e.preventDefault();
      window.parent.postMessage({ type: 'stashbase-open-external', href: url.href }, '*');
    }
  } catch (_) {}
});
</script>`;
  const idx = html.search(/<\/body\s*>/i);
  return idx >= 0 ? html.slice(0, idx) + script + html.slice(idx) : html + script;
}

function htmlToText(html: string): string {
  const withBreaks = html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*(p|div|section|article|li|tr|h[1-6])\s*>/gi, '\n');
  return decodeEntities(withBreaks.replace(/<[^>]+>/g, ' '));
}

/** Decode the HTML entities we care about for preview / chunking —
 *  the named-entity short list (`&nbsp;`, `&amp;`, …) plus numeric
 *  refs (`&#8217;`, `&#x2014;`). Not exhaustive (no `&hellip;`, no
 *  full HTML 5 named-entity table) but covers what arxiv / Wikipedia
 *  exports and hand-written notes use in practice. Exported so the
 *  files-layer preview can reuse it instead of carrying its own copy. */
export function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_m, n: string) => {
      const code = Number(n);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    .replace(/&#x([0-9a-f]+);/gi, (_m, n: string) => {
      const code = Number.parseInt(n, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    });
}

function collapseWhitespace(s: string): string {
  return s.replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
