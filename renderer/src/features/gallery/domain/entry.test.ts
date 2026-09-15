/** What the shop knows about an entry that the published index has not said
 *  yet, and which name a copy takes. */
import { describe, expect, it } from 'vite-plus/test';

import { enrichedFromSnapshot, type GalleryEntry } from './entry';

const published: GalleryEntry = {
  about: null,
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
  about: 'Why it was made.',
  files: ['README.md'],
  screenshots: ['/api/gallery/image?src=bundled'],
  wikiPrompt: 'Build the wiki.',
};

describe('enrichedFromSnapshot', () => {
  it('fills only the slots the published entry left empty', () => {
    expect(enrichedFromSnapshot(published, [bundled])).toMatchObject({
      about: 'Why it was made.',
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
