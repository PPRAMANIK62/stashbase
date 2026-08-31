import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { Slider } from './slider';

function SliderExample({ range = false }: { range?: boolean }) {
  const [value, setValue] = useState<number | [number, number]>(range ? [20, 80] : 40);
  return (
    <div className="w-96 max-w-full">
      <Slider
        formatValue={(item) => `${item}%`}
        label={range ? 'Confidence range' : 'Search threshold'}
        onChange={setValue}
        value={value}
      />
    </div>
  );
}

const meta = {
  title: 'Inputs/Slider',
  component: Slider,
  parameters: { controls: { disable: true }, fluidCanvas: { width: '32rem', minHeight: '14rem' } },
} satisfies Meta<typeof Slider>;

export default meta;
type Story = StoryObj;

export const Value: Story = { render: () => <SliderExample /> };
export const Range: Story = { render: () => <SliderExample range /> };
export const Disabled: Story = {
  render: () => (
    <Slider
      className="w-96 max-w-full"
      disabled
      label="Opacity"
      onChange={() => undefined}
      value={55}
    />
  ),
};
