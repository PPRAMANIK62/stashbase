import { parseDocument } from 'yaml';

import { documentTextFormat } from './document-format';

const OPENING_DELIMITER = /^(?:\uFEFF)?---[\t ]*(?:\r\n?|\n)/u;
const CLOSING_DELIMITER = /^(?:---|\.\.\.)[\t ]*(?:\r\n?|\n|$)/gmu;

export interface MarkdownFrontmatter {
  body: string;
  source: string;
}

export interface RetainableDocumentTab {
  id: string;
  source: { path: string };
}

/** Keep metadata Milkdown does not model outside its serialized document body. */
export function splitLeadingYamlFrontmatter(markdown: string): MarkdownFrontmatter {
  const opening = OPENING_DELIMITER.exec(markdown);
  if (!opening) return { body: markdown, source: '' };

  CLOSING_DELIMITER.lastIndex = opening[0].length;
  const closing = CLOSING_DELIMITER.exec(markdown);
  if (!closing) return { body: markdown, source: '' };

  const parsed = parseDocument(markdown.slice(opening[0].length, closing.index));
  if (parsed.errors.length > 0) return { body: markdown, source: '' };
  return {
    body: markdown.slice(CLOSING_DELIMITER.lastIndex),
    source: markdown.slice(0, CLOSING_DELIMITER.lastIndex),
  };
}

/** An activated Markdown editor lives until its document closes. Its schema,
 * plugin state and history must remain together across navigation. */
export function retainMarkdownTabIds(
  retainedIds: readonly string[],
  tabs: readonly RetainableDocumentTab[],
  activeTabId: string | null,
): string[] {
  const markdownIds = new Set(
    tabs.filter((tab) => documentTextFormat(tab.source.path) === 'md').map((tab) => tab.id),
  );
  const next = retainedIds.filter((id) => markdownIds.has(id));
  if (activeTabId && markdownIds.has(activeTabId)) {
    const previousIndex = next.indexOf(activeTabId);
    if (previousIndex >= 0) next.splice(previousIndex, 1);
    next.unshift(activeTabId);
  }
  return next;
}
