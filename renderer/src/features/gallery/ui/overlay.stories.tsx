import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import type { GalleryEntry } from '@/features/gallery/domain/entry';

import { GalleryOverlay } from './overlay';

const ENTRIES: GalleryEntry[] = [
  {
    category: 'course',
    contents: '20 lecture transcripts · distilled founder playbook',
    description: "Sam Altman's Stanford CS183B course with YC.",
    files: ['README.md', 'wiki/index.md', 'transcripts/Lecture01-HowToStart.md'],
    id: 'cs183b',
    learnMore: null,
    name: 'How to Start a Startup',
    repo: 'https://github.com/owner/cs183b',
    screenshots: [
      'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect width="640" height="400" fill="%236B97FF"/></svg>',
      'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect width="640" height="400" fill="%23334155"/></svg>',
    ],
    starterPrompts: [],
    wikiPrompt:
      'Build or update Wiki Pages from these lecture transcripts: one page per lecture with its key ideas, and a founder playbook that connects them.',
  },
  {
    category: 'reference',
    contents: 'Eight reference sheets · one index',
    description: 'A working reference for typographic detail.',
    files: null,
    id: 'type-reference',
    learnMore: null,
    name: 'Type Reference',
    repo: 'https://github.com/owner/type-reference',
    screenshots: null,
    starterPrompts: [],
    wikiPrompt: null,
  },
];

function ShopPreview({
  opened = false,
  unpublished = false,
}: {
  opened?: boolean;
  unpublished?: boolean;
}) {
  const first = unpublished ? (ENTRIES[1] ?? null) : (ENTRIES[0] ?? null);
  const [entry, setEntry] = useState<GalleryEntry | null>(opened ? first : null);
  return (
    <GalleryOverlay
      copying={false}
      entries={ENTRIES}
      entry={entry}
      issue={null}
      onBack={() => setEntry(null)}
      onClose={() => undefined}
      onCopy={() => undefined}
      onOpen={setEntry}
      open
    />
  );
}

const meta = {
  component: ShopPreview,
  parameters: { controls: { disable: true }, fluidCanvas: { minHeight: '52rem', width: '84rem' } },
  title: 'Gallery/Shop',
} satisfies Meta<typeof ShopPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The shelf: every card one target, opening one entry. */
export const Shelf: Story = {};

/** One entry's page, read top to bottom: the screenshot leads, then what it
 *  is, then the two artifacts side by side, then the one action. */
export const EntryPage: Story = { args: { opened: true } };

/** The same page for an entry that has published neither a file list nor a
 *  build prompt nor screenshots. Every slot states itself; none reshapes the
 *  page. This is also what the shop looks like offline. */
export const UnpublishedEntry: Story = { args: { opened: true, unpublished: true } };
