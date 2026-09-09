import type { Meta, StoryObj } from '@storybook/react-vite';

import { SurfaceProvider } from '@/lib/surface-context';

import { Elevated } from './elevated';

const meta = {
  title: 'Data Display/Elevated',
  component: Elevated,
  parameters: { controls: { disable: true }, fluidCanvas: { width: '30rem', minHeight: '20rem' } },
} satisfies Meta<typeof Elevated>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The two conventional offsets, side by side on the page substrate: a popup
 *  sits two steps above what it opens over, a dialog four. */
export const Offsets: Story = {
  args: {
    offset: 2,
    className: 'rounded-xl p-4 text-body text-foreground',
    children: 'Popup surface — two steps above the page',
  },
};

/** Offsets compose: an Elevated re-provides its own level, so a popup opened
 *  inside a dialog lands two steps above the dialog rather than two above the
 *  page. This is what the story exists to show — the nesting is the contract,
 *  and it is invisible in a single box. */
export const Nested: Story = {
  args: {
    offset: 4,
    className: 'flex flex-col gap-3 rounded-xl p-4 text-body text-foreground',
    children: (
      <>
        Dialog surface — four steps above the page
        <Elevated className="rounded-lg p-3 text-caption" offset={2}>
          Popup surface — two more steps above the dialog
        </Elevated>
      </>
    ),
  },
};

/** `shadowLevel` pins the shadow while the background keeps tracking the
 *  substrate, which is how a dropdown reads the same weight whether it opens
 *  on the page or inside a dialog. */
export const PinnedShadow: Story = {
  args: {
    offset: 2,
    shadowLevel: 3,
    className: 'rounded-xl p-4 text-body text-foreground',
    children: 'Popup surface with a fixed shadow weight',
  },
  decorators: [
    (Story) => (
      <SurfaceProvider value={4}>
        <Story />
      </SurfaceProvider>
    ),
  ],
};
