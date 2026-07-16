import markedFootnote from 'marked-footnote';
import { gfmHeadingId } from 'marked-gfm-heading-id';
import { Marked } from 'marked';

import { normalizeHeadingIds, stripRawHeadingIds } from './headingIds';
import { createPreviewDocument } from './previewDocument';
import { sanitizeMarkdownHtml } from './sanitization';

/** Owns the ordered document-preview transformation pipeline. */
export function renderDocumentMarkdown(markdown: string): string {
  const documentMarkdown = new Marked({ gfm: true, breaks: false });
  // GitHub heading slugs omit colons, so this keeps package-generated
  // footnote targets disjoint from document heading anchors.
  documentMarkdown.use(markedFootnote({ prefixId: 'footnote:' }), gfmHeadingId());
  documentMarkdown.use({
    renderer: {
      html: ({ text }) => stripRawHeadingIds(text),
    },
  });
  const parsed = documentMarkdown.parse(markdown, { async: false }) as string;
  return createPreviewDocument(normalizeHeadingIds(sanitizeMarkdownHtml(parsed)));
}
