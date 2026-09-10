import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { GalleryPort } from '@/features/gallery/application/ports';
import { enrichedFromSnapshot, type GalleryEntry } from '@/features/gallery/domain/entry';
import { GALLERY_SNAPSHOT } from '@/features/gallery/domain/snapshot';

const GALLERY_QUERY_KEY = ['gallery', 'index'] as const;

export interface GalleryView {
  entries: readonly GalleryEntry[];
  /** True while the shop is showing the bundled list because the published one
   *  could not be read. Nothing renders differently for it; a surface that
   *  wants to say so has the fact rather than having to infer it. */
  bundled: boolean;
}

/**
 * The freshest index this window can offer.
 *
 * The bundled snapshot is the initial data rather than a fallback branch, so
 * the shop paints on its first frame and never shows a spinner or an empty
 * state; the published index replaces it in place. The gallery is browsed, not
 * watched, so it is fetched once and kept for the session.
 */
export function useGallery(port: Pick<GalleryPort, 'loadIndex'>): GalleryView {
  // Fetched once and kept: the gallery is browsed, not watched. No initial
  // data, because seeding the cache with the snapshot would mark the query
  // fresh and the published index would never be asked for.
  const query = useQuery({
    gcTime: Infinity,
    queryFn: ({ signal }) => port.loadIndex(signal),
    queryKey: GALLERY_QUERY_KEY,
    retry: false,
    staleTime: Infinity,
  });

  return useMemo(() => {
    const published = query.data ?? null;
    if (!published) return { bundled: true, entries: GALLERY_SNAPSHOT };
    return {
      bundled: false,
      entries: published.map((entry) => enrichedFromSnapshot(entry, GALLERY_SNAPSHOT)),
    };
  }, [query.data]);
}
