/** Display-only cleanup for semantic-search snippets.
 *
 * The indexer keeps a Markdown file's leading YAML frontmatter inside the
 * first chunk (it is legitimately searchable, and the raw chunk text anchors
 * click-through navigation), so a hit on a file's head would otherwise render
 * `--- key: value --- # Title` as its snippet. Strip a valid, explicitly
 * closed frontmatter block so the visible snippet starts at the first
 * content line, leaving `hit.content` itself untouched.
 *
 * Delimiter rules mirror `milkdown/frontmatter.ts`. Instead of that module's
 * full YAML parse (the `yaml` package would land in the main renderer chunk
 * just for display trimming), a light shape check accepts only blocks whose
 * top-level lines look like YAML metadata — so a leading thematic break
 * followed by prose and a second `---` is never eaten.
 */

const OPENING_DELIMITER = /^(?:\uFEFF)?---[\t ]*(?:\r\n?|\n)/;
const CLOSING_DELIMITER = /^(?:---|\.\.\.)[\t ]*(?:\r\n?|\n|$)/gm;

function looksLikeYamlMetadata(block: string): boolean {
  let sawMapping = false;
  for (const line of block.split(/\r\n?|\n/)) {
    if (/^\s*$/.test(line)) continue; // blank
    if (/^\s*#/.test(line)) continue; // comment
    if (/^\s+/.test(line)) continue; // indented continuation / nested value
    if (/^-(\s|$)/.test(line)) continue; // top-level sequence item
    if (/^[^\s:][^:]*:(\s|$)/.test(line)) {
      sawMapping = true;
      continue;
    }
    return false; // prose — this is document content, not metadata
  }
  return sawMapping;
}

/** Snippet text for a search hit: the chunk content minus any leading YAML
 *  frontmatter block, trimmed to the first content line. Falls back to the
 *  original content when nothing would remain (a chunk that is only
 *  frontmatter) so the row never renders empty. */
export function searchSnippetText(content: string): string {
  const opening = OPENING_DELIMITER.exec(content);
  if (!opening) return content;

  CLOSING_DELIMITER.lastIndex = opening[0].length;
  const closing = CLOSING_DELIMITER.exec(content);
  if (!closing) return content;

  if (!looksLikeYamlMetadata(content.slice(opening[0].length, closing.index))) return content;

  const body = content.slice(CLOSING_DELIMITER.lastIndex).replace(/^\s+/, '');
  return body.length > 0 ? body : content;
}
