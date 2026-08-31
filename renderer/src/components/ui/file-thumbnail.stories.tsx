import type { Meta, StoryObj } from '@storybook/react-vite';

import { FileThumbnail } from './file-thumbnail';

const imageFile = new File(
  [
    '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="160" height="160" fill="#6B97FF"/><path d="M24 124 65 74l26 31 19-18 26 37Z" fill="#fff"/></svg>',
  ],
  'workspace-cover.svg',
  { type: 'image/svg+xml' },
);
const textFile = new File(['StashBase notes'], 'notes.md', { type: 'text/markdown' });

const meta = {
  title: 'Data Display/File Thumbnail',
  component: FileThumbnail,
  parameters: { fluidCanvas: { width: '24rem', minHeight: '16rem' } },
  args: { file: imageFile, size: 96 },
  argTypes: { file: { control: false }, size: { control: { type: 'range', min: 32, max: 160 } } },
} satisfies Meta<typeof FileThumbnail>;

export default meta;
type Story = StoryObj;

export const Image: Story = {};
export const GenericDocument: Story = { args: { file: textFile } };
