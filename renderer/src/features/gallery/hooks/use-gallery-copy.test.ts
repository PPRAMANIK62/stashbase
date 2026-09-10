/** Taking a copy: one at a time, and a refusal that leaves the entry retryable. */
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vite-plus/test';

import type { GalleryEntry } from '@/features/gallery/domain/entry';

import { useGalleryCopy } from './use-gallery-copy';

const ENTRY: GalleryEntry = {
  category: 'course',
  contents: '20 transcripts',
  description: 'A course.',
  files: null,
  id: 'cs183b',
  learnMore: null,
  name: 'How to Start a Startup',
  repo: 'https://github.com/owner/repo',
  screenshots: null,
  starterPrompts: [],
  wikiPrompt: null,
};

describe('useGalleryCopy', () => {
  it('asks for the entry by name and repository and nothing else', async () => {
    const copy = vi.fn(async () => '/library/How to Start a Startup');
    const { result } = renderHook(() => useGalleryCopy({ copy }));

    act(() => result.current.copy(ENTRY));
    await waitFor(() => expect(result.current.copyingId).toBeNull());

    // Where a copy lands and what it may be called are the Library's rules.
    expect(copy).toHaveBeenCalledWith(
      { name: 'How to Start a Startup', repo: 'https://github.com/owner/repo' },
      expect.anything(),
    );
  });

  it('ignores a second click while one copy is in flight', async () => {
    let release!: (path: string) => void;
    const copy = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          release = resolve;
        }),
    );
    const { result } = renderHook(() => useGalleryCopy({ copy }));

    act(() => result.current.copy(ENTRY));
    act(() => result.current.copy(ENTRY));
    // Two copies must be two deliberate acts, not one bounce off a large
    // button.
    expect(copy).toHaveBeenCalledTimes(1);
    expect(result.current.copyingId).toBe('cs183b');

    await act(async () => {
      release('/library/copy');
    });
    expect(result.current.copyingId).toBeNull();
  });

  it('names a refusal and leaves the entry retryable', async () => {
    const copy = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('That repository is private or does not exist.'))
      .mockResolvedValueOnce('/library/copy');
    const { result } = renderHook(() => useGalleryCopy({ copy }));

    act(() => result.current.copy(ENTRY));
    await waitFor(() =>
      expect(result.current.issue).toBe(
        'Could not get this Wiki: That repository is private or does not exist.',
      ),
    );

    // The Library is unchanged by a failed copy, so the same button retries it
    // and the previous refusal clears.
    act(() => result.current.copy(ENTRY));
    await waitFor(() => expect(result.current.issue).toBeNull());
    expect(copy).toHaveBeenCalledTimes(2);
  });
});
