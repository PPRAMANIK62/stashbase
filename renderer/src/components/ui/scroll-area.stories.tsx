import type { Meta, StoryObj } from '@storybook/react-vite';

import { ScrollArea } from './scroll-area';

const releases = Array.from({ length: 24 }, (_, index) => `v2.${23 - index}.0`);

const meta = {
  title: 'Data Display/Scroll Area',
  component: ScrollArea,
  parameters: { controls: { disable: true }, fluidCanvas: { width: '30rem', minHeight: '28rem' } },
} satisfies Meta<typeof ScrollArea>;

export default meta;
type Story = StoryObj;

export const Vertical: Story = {
  render: () => (
    <ScrollArea className="h-64 w-72" viewportClassName="scroll-fade">
      <ul className="space-y-1 p-2">
        {releases.map((release) => (
          <li className="rounded-lg px-3 py-2 text-sm hover:bg-hover" key={release}>
            {release} · maintenance release
          </li>
        ))}
      </ul>
    </ScrollArea>
  ),
};

export const Horizontal: Story = {
  render: () => (
    <ScrollArea
      className="w-96 max-w-full"
      orientation="horizontal"
      viewportClassName="scroll-fade-x"
    >
      <div className="flex w-max gap-2 p-3">
        {releases.slice(0, 12).map((release) => (
          <span className="rounded-lg bg-accent px-4 py-3 text-sm" key={release}>
            {release}
          </span>
        ))}
      </div>
    </ScrollArea>
  ),
};
