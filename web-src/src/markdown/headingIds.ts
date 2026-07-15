/** Adds deterministic, duplicate-safe IDs to rendered document headings. */
export function addHeadingIds(html: string): string {
  const nextSuffix = new Map<string, number>();
  const usedSlugs = new Set<string>();
  return html.replace(
    /<h([1-6])(\s[^>]*)?>([\s\S]*?)<\/h\1>/g,
    (_match, level: string, attrs: string | undefined, inner: string) => {
      const text = stripInlineTags(inner).trim();
      const id = nextSlug(text, nextSuffix, usedSlugs);
      const safeAttrs = (attrs ?? '').replace(/\sid=(?:"[^"]*"|'[^']*'|[^\s>]+)/i, '');
      return `<h${level} id="${id}"${safeAttrs}>${inner}</h${level}>`;
    },
  );
}

/** Shared punctuation-insensitive slug shape for headings and footnote labels. */
export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function nextSlug(
  text: string,
  nextSuffix: Map<string, number>,
  usedSlugs: Set<string>,
): string {
  const base = slugifyHeading(text) || 'section';
  let suffix = nextSuffix.get(base) ?? 0;
  let candidate = suffix === 0 ? base : `${base}-${suffix}`;
  while (usedSlugs.has(candidate)) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
  nextSuffix.set(base, suffix + 1);
  usedSlugs.add(candidate);
  return candidate;
}

function stripInlineTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}
