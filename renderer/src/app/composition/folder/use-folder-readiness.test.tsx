import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { folderIndexStatus } from '@/test/fakes/preparation';
import { listing, listingFile } from '@/test/fakes/workspace';

import { useFolderReadiness } from './use-folder-readiness';

afterEach(cleanup);

const folderListing = listing([
  listingFile({ format: 'md', path: 'notes.md' }),
  listingFile({ format: 'pdf', path: 'study.pdf' }),
]);

describe('useFolderReadiness', () => {
  it('marks nothing before the status has answered', () => {
    const { result } = renderHook(() => useFolderReadiness(folderListing, null));

    expect(result.current.rowMarkers).toEqual({});
    expect(result.current.search.counts.needsAttention).toBe(false);
  });

  it('marks only the rows that need the reader', () => {
    const status = folderIndexStatus({
      // Pending work is quiet; a failure is what a row has to say out loud.
      pendingConversions: ['notes.md'],
      preparationFailures: [
        { attempts: 1, lastError: 'unreadable', path: 'study.pdf', status: 'failed' as const },
      ],
    });
    const { result } = renderHook(() => useFolderReadiness(folderListing, status));

    expect(Object.keys(result.current.rowMarkers)).toEqual(['study.pdf']);
    expect(result.current.rowMarkers['study.pdf']?.kind).toBe('failed');
  });

  it('raises the folder summary when a source has failed', () => {
    const status = folderIndexStatus({
      preparationFailures: [
        { attempts: 1, lastError: 'unreadable', path: 'study.pdf', status: 'failed' as const },
      ],
    });
    const { result } = renderHook(() => useFolderReadiness(folderListing, status));

    expect(result.current.search.counts.needsAttention).toBe(true);
  });

  it('keeps the markers stable while nothing it reads has changed', () => {
    const status = folderIndexStatus({
      preparationFailures: [
        { attempts: 1, lastError: 'unreadable', path: 'study.pdf', status: 'failed' as const },
      ],
    });
    const { rerender, result } = renderHook(() => useFolderReadiness(folderListing, status));
    const first = result.current.rowMarkers;

    rerender();

    expect(result.current.rowMarkers).toBe(first);
  });
});
