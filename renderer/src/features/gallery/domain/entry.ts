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
  /** The introduction the page opens with: why the wiki was made, what it
   *  holds, who it is for. Plain text, paragraphs separated by a blank line. */
  readonly about: string | null;
  /** Published for the site; the app renders no surface for it. */
  readonly contents: string;
  readonly repo: string;
  readonly learnMore: string | null;
  /** Published for the site; the app renders no surface for them. */
  readonly starterPrompts: readonly string[];
  /** Published for the site; the app renders no surface for it. */
  readonly files: readonly string[] | null;
  /** The generating request, shown as Prompt; not ongoing Agent instructions. */
  readonly wikiPrompt: string | null;
  /** Already pointed at the daemon's proxy; the renderer may not reach the CDN. */
  readonly screenshots: readonly string[] | null;
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
    about: entry.about ?? bundled.about,
    files: entry.files ?? bundled.files,
    screenshots: entry.screenshots ?? bundled.screenshots,
    wikiPrompt: entry.wikiPrompt ?? bundled.wikiPrompt,
  };
}
