/** What the shop knows about an entry that the published index has not said
 *  yet, and how What's inside states its two shapes. */
import { describe, expect, it } from 'vite-plus/test';

import { enrichedFromSnapshot, galleryContents, type GalleryEntry } from './entry';

const published: GalleryEntry = {
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

const bundled: GalleryEntry = {
  ...published,
  files: ['README.md'],
  screenshots: ['/api/gallery/image?src=bundled'],
  wikiPrompt: 'Build the wiki.',
};

describe('enrichedFromSnapshot', () => {
  it('fills only the slots the published entry left empty', () => {
    expect(enrichedFromSnapshot(published, [bundled])).toMatchObject({
      files: ['README.md'],
      screenshots: ['/api/gallery/image?src=bundled'],
      wikiPrompt: 'Build the wiki.',
    });
  });

  it('never overwrites a published value with a bundled one', () => {
    // The index is the service contract. A build shipping a stale prompt must
    // not put it back over the one the gallery just published.
    const fresh = { ...published, wikiPrompt: 'Build it the new way.' };
    expect(enrichedFromSnapshot(fresh, [bundled]).wikiPrompt).toBe('Build it the new way.');
  });

  it('leaves an entry the snapshot has never heard of alone', () => {
    expect(enrichedFromSnapshot({ ...published, id: 'new-entry' }, [bundled]).files).toBeNull();
  });
});

describe('galleryContents', () => {
  it('lists the published files, and stands in with the inventory line until then', () => {
    expect(galleryContents(bundled)).toEqual({ files: ['README.md'], kind: 'files' });
    expect(galleryContents(published)).toEqual({ kind: 'summary', line: '20 transcripts' });
    // An entry that published an empty list has published nothing usable, so
    // the stand-in answers rather than an empty tree.
    expect(galleryContents({ ...published, files: [] })).toEqual({
      kind: 'summary',
      line: '20 transcripts',
    });
  });
});
