import { z } from 'zod';

/**
 * The Gallery index: ready-made Wikis a reader can copy into the Library.
 *
 * The whole service contract is one published JSON document, fetched through
 * the daemon's proxy because the renderer's CSP pins `connect-src` to `'self'`.
 * Two rules shape this schema.
 *
 * Fields are additive-only, so every object strips rather than refuses: an
 * index published by a newer gallery must still read here. `schemaVersion`
 * is the one gate on that, and it is a literal rather than a minimum — a shape
 * this build does not understand has to fail the parse whole, because the
 * fallback is the bundled snapshot and a half-read shop is worse than a
 * slightly stale one.
 *
 * An entry is refused rather than dropped when its own required fields are
 * missing. One unusable entry means the publication is wrong, and quietly
 * showing the rest would hide that from everyone including the publisher.
 */
export const GALLERY_SCHEMA_VERSION = 1;

const line = (max: number) => z.string().trim().min(1).max(max);

export const galleryEntrySchema = z
  .object({
    /** Stable slug, never reused. */
    id: line(200),
    name: line(200),
    /** One word: `course`, `research`, `reference`, … */
    category: line(80),
    /** One sentence: source, then what is inside. */
    description: line(1_000),
    /** The introduction the entry page opens with, in the publisher's own
     *  words: why the wiki was made, what it holds, who it is for. Plain
     *  text; a blank line separates paragraphs. */
    about: line(8_000).optional(),
    /** One line of inventory. Published for the site; the app renders no
     *  surface for it. */
    contents: line(1_000),
    /** Public repository holding the whole wiki, copied by the same import
     *  the Library switcher uses. */
    repo: line(2_048),
    /** Optional deep-dive page on the site. Carried so a published entry
     *  round-trips whole even though the app renders no surface for it. */
    learnMore: line(2_048).optional(),
    /** Questions worth asking once the copy is open. Published for the site;
     *  the app carries them without a surface of its own. */
    starterPrompts: z.array(line(1_000)).max(50).default([]),
    /** Folder-relative paths of the copy's visible files. Dot-entries stay
     *  out. Carried so a published entry round-trips whole; the app renders
     *  no surface for it. */
    files: z.array(line(1_024)).max(2_000).optional(),
    /** The Build Wiki request that produced this wiki; the entry page shows
     *  it as the copy's Agent Instructions. */
    wikiPrompt: line(4_000).optional(),
    /** Absolute CDN URLs, gallery order, the first one the hero. */
    screenshots: z.array(line(2_048)).max(20).optional(),
  })
  .strip();

export const galleryIndexSchema = z
  .object({
    schemaVersion: z.literal(GALLERY_SCHEMA_VERSION),
    /** Bounded for the same reason every array inside an entry is: this
     *  document arrives from a host outside the machine, and a shelf is
     *  browsed by a reader rather than paged. An index past this is a
     *  publication mistake, and refusing it whole falls back to the bundled
     *  snapshot, which is the same answer as any other unreadable index. */
    wikis: z.array(galleryEntrySchema).max(500),
  })
  .strip();

export type GalleryEntryWire = z.infer<typeof galleryEntrySchema>;
export type GalleryIndexWire = z.infer<typeof galleryIndexSchema>;
