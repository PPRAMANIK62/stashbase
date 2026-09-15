import type { GalleryEntry } from '@/features/gallery/domain/entry';

/** The Gallery supplies examples; project acquisition belongs to Workspace. */
export interface GalleryPort {
  loadIndex(signal: AbortSignal): Promise<readonly GalleryEntry[] | null>;
}
