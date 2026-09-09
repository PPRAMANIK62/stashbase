import type { Meta, StoryObj } from '@storybook/react-vite';

import { Kbd } from './kbd';

const meta = {
  title: 'Data Display/Kbd',
  component: Kbd,
  parameters: { controls: { disable: true }, fluidCanvas: { width: '24rem', minHeight: '9rem' } },
} satisfies Meta<typeof Kbd>;

export default meta;
type Story = StoryObj;

/** The three faces, each on the surface it is meant for. */
export const Variants: Story = {
  render: () => (
    <div className="flex flex-col gap-3 text-caption text-muted-foreground">
      <span className="flex items-center gap-2">
        <Kbd>Tab</Kbd> completes the suggested prompt
      </span>
      <span className="flex items-center gap-2">
        <Kbd variant="filled">⌘K</Kbd> opens the command menu
      </span>
      <span className="flex items-center gap-2 rounded-lg bg-foreground px-3 py-2 text-background">
        <Kbd variant="inverted">[</Kbd> toggles the sidebar
      </span>
    </div>
  ),
};

/** A chord reads as one key per cap. */
export const Chord: Story = {
  render: () => (
    <span className="flex items-center gap-1">
      <Kbd>⌘</Kbd>
      <Kbd>⇧</Kbd>
      <Kbd>P</Kbd>
    </span>
  ),
};

/** Pinned to the compact step, for dense chrome that does not shrink with it. */
export const Compact: Story = {
  render: () => (
    <span className="flex items-center gap-1">
      <Kbd size="compact">⌘</Kbd>
      <Kbd size="compact">S</Kbd>
    </span>
  ),
};
