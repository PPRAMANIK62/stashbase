/** What the shop shows before, during, and after the published index answers. */
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vite-plus/test';

import type { GalleryEntry } from '@/features/gallery/domain/entry';
import { GALLERY_SNAPSHOT } from '@/features/gallery/domain/snapshot';
import { createTestQueryClient, queryWrapper } from '@/test/query';

import { useGallery } from './use-gallery';

const bundledId = GALLERY_SNAPSHOT[0]?.id ?? '';

function published(overrides: Partial<GalleryEntry> = {}): GalleryEntry {
  return {
    category: 'course',
    contents: 'Published inventory',
    description: 'A course.',
    files: null,
    id: bundledId,
    learnMore: null,
    name: 'How to Start a Startup',
    repo: 'https://github.com/owner/repo',
    screenshots: null,
    starterPrompts: [],
    wikiPrompt: null,
    ...overrides,
  };
}

function mount(loadIndex: () => Promise<readonly GalleryEntry[] | null>) {
  return renderHook(() => useGallery({ loadIndex }), {
    wrapper: queryWrapper(createTestQueryClient()),
  });
}

describe('useGallery', () => {
  it('paints the bundled shelf on the first frame rather than an empty state', () => {
    const { result } = mount(async () => [published()]);
    expect(result.current.bundled).toBe(true);
    expect(result.current.entries).toEqual(GALLERY_SNAPSHOT);
  });

  it('replaces the shelf with the published index and fills its gaps', async () => {
    const { result } = mount(async () => [published()]);
    await waitFor(() => expect(result.current.bundled).toBe(false));
    // Published values win; the build's own knowledge fills what the index has
    // not said yet.
    expect(result.current.entries[0]?.contents).toBe('Published inventory');
    expect(result.current.entries[0]?.files).toEqual(GALLERY_SNAPSHOT[0]?.files);
  });

  it('keeps the bundled shelf when the index cannot be read', async () => {
    const loadIndex = vi.fn(async () => null);
    const { result } = mount(loadIndex);
    await waitFor(() => expect(loadIndex).toHaveBeenCalled());
    expect(result.current.bundled).toBe(true);
    expect(result.current.entries).toEqual(GALLERY_SNAPSHOT);
  });
});
