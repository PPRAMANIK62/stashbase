import type { Meta, StoryObj } from '@storybook/react-vite';
import { ArrowRight, Plus } from 'lucide-react';
import { expect, fn, userEvent, within } from 'storybook/test';

import { Button } from './button';

const onClick = fn();

const meta = {
  title: 'Actions/Button',
  component: Button,
  parameters: { fluidCanvas: { width: '24rem', minHeight: '10rem' } },
  args: {
    children: 'Save changes',
    onClick,
    variant: 'primary',
  },
  argTypes: {
    variant: { control: 'inline-radio', options: ['primary', 'secondary', 'tertiary', 'ghost'] },
    size: { control: 'select', options: ['default', 'compact', 'icon', 'icon-compact'] },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj;

export const Playground: Story = {};

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="tertiary">Tertiary</Button>
      <Button variant="ghost">Ghost</Button>
    </div>
  ),
};

export const IconsAndLoading: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Button leadingIcon={Plus}>New project</Button>
      <Button trailingIcon={ArrowRight} variant="secondary">
        Continue
      </Button>
      <Button loading>Saving</Button>
      <Button aria-label="Add" size="icon" variant="tertiary">
        <Plus />
      </Button>
    </div>
  ),
};

export const Clicked: Story = {
  // Re-runnable: the handler is a module-level mock shared with every other
  // story in this file, and the accessibility run replays each play once per
  // environment. Clearing first keeps "exactly once" a claim about this click.
  play: async ({ canvasElement }) => {
    onClick.mockClear();
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Save changes' }));
    await expect(onClick).toHaveBeenCalledOnce();
  },
};
