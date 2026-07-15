import { addHeadingIds } from './headingIds';
import { parseMarkdownWithFootnotes } from './footnotes';
import { createPreviewDocument } from './previewDocument';
import { sanitizeMarkdownHtml } from './sanitization';

/** Owns the ordered document-preview transformation pipeline. */
export function renderDocumentMarkdown(markdown: string): string {
  const parsed = parseMarkdownWithFootnotes(markdown);
  const sanitized = sanitizeMarkdownHtml(parsed);
  const withHeadingIds = addHeadingIds(sanitized);
  return createPreviewDocument(withHeadingIds);
}
