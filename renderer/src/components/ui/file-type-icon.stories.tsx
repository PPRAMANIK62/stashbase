import type { Meta, StoryObj } from '@storybook/react-vite';

import { FileTypeIcon } from './file-type-icon';

const paths = [
  'notes/reading-list.md',
  'reports/quarterly.pdf',
  'design/cover.png',
  'src/session-runtime.ts',
  'config/settings.json',
  'audio/interview.mp3',
  'clips/demo.mp4',
  'archive/backup.bin',
];

const meta = {
  title: 'Data Display/File Type Icon',
  component: FileTypeIcon,
  parameters: { controls: { disable: true }, fluidCanvas: { width: '26rem', minHeight: '14rem' } },
} satisfies Meta<typeof FileTypeIcon>;

export default meta;
type Story = StoryObj;

/** The extension picks the glyph; anything unrecognised falls back to a
 *  question-marked page rather than guessing. */
export const ByExtension: Story = {
  render: () => (
    <ul className="flex w-full flex-col gap-1.5">
      {paths.map((path) => (
        <li className="flex items-center gap-2 text-body text-foreground" key={path}>
          <FileTypeIcon
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground"
            path={path}
          />
          <span className="truncate">{path}</span>
        </li>
      ))}
    </ul>
  ),
};
