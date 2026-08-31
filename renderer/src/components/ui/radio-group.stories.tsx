import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { RadioGroup, RadioItem } from './radio-group';

function RadioExample() {
  const [value, setValue] = useState('local');
  const choices = [
    ['local', 'Local index'],
    ['hosted', 'Hosted search'],
    ['off', 'Disabled'],
  ] as const;

  return (
    <RadioGroup value={value} onValueChange={setValue} aria-label="Search provider">
      {choices.map(([itemValue, label], index) => (
        <RadioItem index={index} key={itemValue} label={label} value={itemValue} />
      ))}
    </RadioGroup>
  );
}

const meta = {
  title: 'Inputs/Radio Group',
  component: RadioGroup,
  subcomponents: { RadioItem },
  parameters: { controls: { disable: true }, fluidCanvas: { width: '28rem', minHeight: '18rem' } },
} satisfies Meta<typeof RadioGroup>;

export default meta;
type Story = StoryObj;

export const SingleSelection: Story = { render: () => <RadioExample /> };
