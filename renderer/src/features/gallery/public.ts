/**
 * The Gallery feature's whole surface to `renderer/src/app`.
 *
 * The shop is composed rather than routed: the band is a slot the bare
 * window's welcome screen renders, and the overlay is opened by the workspace
 * sidebar. Both take the same entries and the same open handler, so there is
 * one shop with two frames rather than two shops.
 */
export type { GalleryPort } from './application/ports';
export { copyFolderName } from './domain/entry';
export type { GalleryCopyRequest, GalleryEntry } from './domain/entry';
export { GALLERY_SNAPSHOT } from './domain/snapshot';
export { createGalleryIndexAdapter } from './infrastructure/gallery-api';
export { useGallery, type GalleryView } from './hooks/use-gallery';
export { useGalleryCopy, type GalleryCopyState } from './hooks/use-gallery-copy';
export { GalleryOverlay } from './ui/overlay';
export { GalleryShop } from './ui/shop';
