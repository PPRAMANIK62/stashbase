import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { FileTypeIcon } from './file-type-icon';
import { InlineInput } from './inline-input';

const meta = {
  title: 'Inputs/Inline Input',
  component: InlineInput,
  parameters: { controls: { disable: true }, fluidCanvas: { width: '24rem', minHeight: '9rem' } },
} satisfies Meta<typeof InlineInput>;

export default meta;
type Story = StoryObj;

function RenameRow({ selection }: { selection?: { end: number; start: number } }) {
  const [name, setName] = useState('quarterly-report.md');
  const [committed, setCommitted] = useState<string | null>(null);
  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex h-7 items-center gap-1.5 rounded-md px-2 text-body">
        <FileTypeIcon className="size-4 shrink-0 text-muted-foreground" path={name} />
        <InlineInput
          aria-label="File name"
          onCancel={() => setCommitted('cancelled')}
          onChange={setName}
          onCommit={() => setCommitted(name)}
          value={name}
          {...(selection ? { selection } : {})}
        />
      </div>
      <p className="text-caption text-muted-foreground">
        {committed === null ? 'Editing — press Enter to commit, Escape to cancel.' : committed}
      </p>
    </div>
  );
}

/** Renaming in place: the row keeps its own type and spacing. */
export const Rename: Story = { render: () => <RenameRow /> };

/** `selection` pre-selects the run the caller expects to be replaced — here
 *  the stem, leaving the extension intact. */
export const StemPreselected: Story = {
  render: () => <RenameRow selection={{ end: 16, start: 0 }} />,
};
