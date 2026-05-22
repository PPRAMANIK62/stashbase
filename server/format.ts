/**
 * Leaf module for file-format detection.
 *
 * Lives separately from `files.ts` because `files.ts` imports from
 * `watcher.ts` (→ `state.ts`, which instantiates `MfsIndexer` at module
 * top level). The MCP bundle entry only needs `detectFormat`, so
 * isolating it here keeps `mcp/server.ts` → `indexer.mfs.ts` from
 * pulling watcher/state into the bundle and creating an init-order
 * cycle that the packaged bundle can't resolve correctly.
 */

export type FileFormat = 'md' | 'html';

/** Recognised note extensions and how the rest of the pipeline should
 *  treat them. Adding a format = one line here + a chunker + a viewer. */
const NOTE_FORMATS: Array<{ pattern: RegExp; format: FileFormat }> = [
  { pattern: /\.(md|markdown)$/i, format: 'md' },
  { pattern: /\.(html|htm)$/i, format: 'html' },
];

export function detectFormat(name: string): FileFormat | null {
  for (const { pattern, format } of NOTE_FORMATS) {
    if (pattern.test(name)) return format;
  }
  return null;
}
