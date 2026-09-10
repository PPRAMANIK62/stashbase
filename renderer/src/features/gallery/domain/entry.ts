/**
 * One ready-made Wiki as the shop reads it.
 *
 * The published index is the whole service contract, so this shape is the wire
 * shape with its optionals made explicit: a field the gallery has not published
 * yet is `null` rather than absent, because every surface has to state that
 * absence rather than quietly render a shorter page.
 */
export interface GalleryEntry {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly description: string;
  /** Short inventory line, standing in for What's inside until `files` lands. */
  readonly contents: string;
  readonly repo: string;
  readonly learnMore: string | null;
  readonly starterPrompts: readonly string[];
  readonly files: readonly string[] | null;
  readonly wikiPrompt: string | null;
  /** Already pointed at the daemon's proxy; the renderer may not reach the CDN. */
  readonly screenshots: readonly string[] | null;
}

/** What Make a copy asks for. The gallery names the entry and its repository
 *  and nothing else: where a copy lands and what it may be called are the
 *  Library's rules, not the shop's. */
export interface GalleryCopyRequest {
  readonly name: string;
  readonly repo: string;
}

/**
 * The published index wins whole, but a build often knows more about an entry
 * than the index has published yet — the app ships fields ahead of their
 * publication. A same-id snapshot entry fills only the slots the published one
 * left empty, and a published value always wins where it exists.
 */
export function enrichedFromSnapshot(
  entry: GalleryEntry,
  snapshot: readonly GalleryEntry[],
): GalleryEntry {
  const bundled = snapshot.find((candidate) => candidate.id === entry.id);
  if (!bundled) return entry;
  return {
    ...entry,
    files: entry.files ?? bundled.files,
    screenshots: entry.screenshots ?? bundled.screenshots,
    wikiPrompt: entry.wikiPrompt ?? bundled.wikiPrompt,
  };
}

/** What the detail page lists under What's inside: the published file list, or
 *  the inventory line standing in for it. Naming the two states here keeps the
 *  page from inventing a third. */
export type GalleryContents =
  | { readonly kind: 'files'; readonly files: readonly string[] }
  | { readonly kind: 'summary'; readonly line: string };

export function galleryContents(entry: GalleryEntry): GalleryContents {
  return entry.files && entry.files.length > 0
    ? { files: entry.files, kind: 'files' }
    : { kind: 'summary', line: entry.contents };
}
