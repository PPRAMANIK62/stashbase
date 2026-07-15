/** Stable Markdown rendering seam used by document preview and Agent messages. */
import { Marked } from 'marked';

import { renderDocumentMarkdown } from './markdown/documentRenderer';

const inlineMarkdown = new Marked({ gfm: true, breaks: true });

/** Markdown → HTML fragment rendered inside the app DOM for Agent messages. */
export function renderMarkdownInline(md: string): string {
  return inlineMarkdown.parse(md ?? '', { async: false }) as string;
}

/** Markdown → self-contained HTML document for the sandboxed preview iframe. */
export function renderMarkdown(md: string): string {
  return renderDocumentMarkdown(md ?? '');
}
