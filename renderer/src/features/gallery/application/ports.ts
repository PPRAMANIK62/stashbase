import type { GalleryCopyRequest, GalleryEntry } from '@/features/gallery/domain/entry';

/**
 * Everything the shop needs from outside itself.
 *
 * `loadIndex` answers `null` for an index this build cannot read — unreachable,
 * malformed, or a schema version it does not understand are one outcome, not
 * three, because the response to all of them is the bundled snapshot. Half an
 * index is never an answer.
 *
 * `copy` is the whole take-this action, including where the copy lands and the
 * window it opens in. The shop deliberately does not own those: a copy is an
 * ordinary Library member acquired by the ordinary import, and the composition
 * wires both. It answers the published path so a caller can name what it made.
 */
export interface GalleryPort {
  copy(request: GalleryCopyRequest, signal: AbortSignal): Promise<string>;
  loadIndex(signal: AbortSignal): Promise<readonly GalleryEntry[] | null>;
}
