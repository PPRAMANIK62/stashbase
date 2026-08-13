/** File-type categories the search surfaces can filter by. Shared
 *  vocabulary between the renderer (chips) and the server (extension
 *  mapping); the category → extension mapping itself stays in
 *  `server/format.ts` next to the other extension knowledge. */
export const SEARCH_TYPE_CATEGORIES = ['notes', 'data', 'pdf', 'image', 'docx', 'audio'] as const;

export type SearchTypeCategory = (typeof SEARCH_TYPE_CATEGORIES)[number];

export function isSearchTypeCategory(value: unknown): value is SearchTypeCategory {
  return typeof value === 'string' && (SEARCH_TYPE_CATEGORIES as readonly string[]).includes(value);
}

export const SEARCH_TYPES_VALIDATION_ERROR =
  `unknown search type; types must be an array containing only: ${SEARCH_TYPE_CATEGORIES.join(', ')}`;

/** Normalizes an optional transport value into the shared search vocabulary.
 *  Absent → empty list (no filter); malformed input or any unknown entry →
 *  null so each transport can return its native validation error envelope. */
export function parseSearchTypes(raw: unknown): SearchTypeCategory[] | null {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return null;
  const out: SearchTypeCategory[] = [];
  for (const entry of raw) {
    const value = typeof entry === 'string' ? entry.trim() : entry;
    if (!isSearchTypeCategory(value)) return null;
    if (!out.includes(value)) out.push(value);
  }
  return out;
}
