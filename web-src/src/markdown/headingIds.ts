import GithubSlugger from 'github-slugger';

const FOOTNOTE_LABEL = '<h2 id="footnote:label" class="sr-only">Footnotes</h2>';
const FOOTNOTE_LABEL_PLACEHOLDER = '<stashbase-footnote-label></stashbase-footnote-label>';

/** Removes author-controlled IDs before raw HTML headings enter the sanitizer. */
export function stripRawHeadingIds(html: string): string {
  return html.replace(/<h([1-6])(\s[^>]*)?>/gi, (_match, level: string, attributes: string | undefined) => {
    const safeAttributes = (attributes ?? '').replace(/\sid=(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
    return `<h${level}${safeAttributes}>`;
  });
}

/** Normalizes raw and Markdown headings into one GitHub-style ID namespace. */
export function normalizeHeadingIds(html: string): string {
  const slugger = new GithubSlugger();
  const withProtectedFootnoteLabel = html.replace(
    /(<section class="footnotes" data-footnotes>\s*)<h2 id="footnote:label" class="sr-only">Footnotes<\/h2>/,
    `$1${FOOTNOTE_LABEL_PLACEHOLDER}`,
  );

  return withProtectedFootnoteLabel.replace(
    /<h([1-6])(\s[^>]*)?>([\s\S]*?)<\/h\1>/g,
    (match, level: string, attributes: string | undefined, inner: string) => {
      const id = slugger.slug(unescapeHeadingText(stripInlineTags(inner)).trim().toLowerCase());
      const safeAttributes = (attributes ?? '').replace(/\sid="[^"]*"/i, '');
      return `<h${level} id="${id}"${safeAttributes}>${inner}</h${level}>`;
    },
  ).replace(FOOTNOTE_LABEL_PLACEHOLDER, FOOTNOTE_LABEL);
}

function stripInlineTags(html: string): string {
  return html.replace(/<[^>]+>/g, '');
}

function unescapeHeadingText(html: string): string {
  return html.replace(/&(#(?:\d+)|(?:#x[0-9A-Fa-f]+)|(?:\w+));?/ig, (_match, entity: string) => {
    const normalized = entity.toLowerCase();
    if (normalized === 'colon') return ':';
    if (normalized.startsWith('#x')) return String.fromCharCode(parseInt(normalized.slice(2), 16));
    if (normalized.startsWith('#')) return String.fromCharCode(Number(normalized.slice(1)));
    return '';
  });
}
