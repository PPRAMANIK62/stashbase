/** Stable Markdown rendering seam for Agent-message fragments. */
import { Marked } from 'marked';

const inlineMarkdown = new Marked({ gfm: true, breaks: true });

/** Markdown → HTML fragment rendered inside the app DOM for Agent messages. */
export function renderMarkdownInline(md: string): string {
  return inlineMarkdown.parse(md ?? '', { async: false }) as string;
}
