import markedFootnote from 'marked-footnote';
import { gfmHeadingId } from 'marked-gfm-heading-id';
import { Marked } from 'marked';

import { createPreviewDocument } from './previewDocument';
import { sanitizeMarkdownHtml } from './sanitization';

/** Owns the ordered document-preview transformation pipeline. */
export function renderDocumentMarkdown(markdown: string): string {
  const documentMarkdown = new Marked({ gfm: true, breaks: false });
  documentMarkdown.use(markedFootnote(), gfmHeadingId());
  const parsed = documentMarkdown.parse(markdown, { async: false }) as string;
  return createPreviewDocument(sanitizeMarkdownHtml(parsed));
}
