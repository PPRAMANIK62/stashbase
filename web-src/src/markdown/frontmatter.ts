import { parseDocument } from 'yaml';

const OPENING_DELIMITER = /^(?:\uFEFF)?---[\t ]*(?:\r\n?|\n)/;
const CLOSING_DELIMITER = /^(?:---|\.\.\.)[\t ]*(?:\r\n?|\n|$)/gm;

/** Removes only valid, explicitly closed leading YAML frontmatter. */
export function stripLeadingYamlFrontmatter(markdown: string): string {
  const opening = OPENING_DELIMITER.exec(markdown);
  if (!opening) return markdown;

  CLOSING_DELIMITER.lastIndex = opening[0].length;
  const closing = CLOSING_DELIMITER.exec(markdown);
  if (!closing) return markdown;

  const frontmatter = parseDocument(markdown.slice(opening[0].length, closing.index));
  return frontmatter.errors.length === 0 ? markdown.slice(CLOSING_DELIMITER.lastIndex) : markdown;
}
