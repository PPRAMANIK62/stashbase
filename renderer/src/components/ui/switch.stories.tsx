import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { Switch } from './switch';

function SwitchExample({ disabled = false }: { disabled?: boolean }) {
  const [checked, setChecked] = useState(true);
  return (
    <Switch
      checked={checked}
      disabled={disabled}
      label="Index new documents automatically"
      onToggle={() => setChecked((value) => !value)}
    />
  );
}

const meta = {
  title: 'Inputs/Switch',
  component: Switch,
  parameters: { controls: { disable: true }, fluidCanvas: { width: '24rem', minHeight: '14rem' } },
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj;

export const Interactive: Story = { render: () => <SwitchExample /> };
export const Disabled: Story = { render: () => <SwitchExample disabled /> };
