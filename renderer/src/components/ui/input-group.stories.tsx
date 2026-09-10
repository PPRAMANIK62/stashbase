import type { Meta, StoryObj } from '@storybook/react-vite';
import { Mail, Search } from 'lucide-react';
import { useState } from 'react';

import { InputField, InputGroup } from './input-group';

function InputGroupExample({ error = false }: { error?: boolean }) {
  const [search, setSearch] = useState('');
  const [email, setEmail] = useState(error ? 'bad@' : '');
  return (
    <InputGroup className="w-96 max-w-full">
      <InputField
        icon={Search}
        label="Search"
        onChange={setSearch}
        placeholder="Search documents"
        value={search}
      />
      <InputField
        error={error ? 'Enter a complete email address.' : undefined}
        icon={Mail}
        label="Email"
        onChange={setEmail}
        placeholder="you@example.com"
        value={email}
      />
    </InputGroup>
  );
}

const meta = {
  title: 'Inputs/Input Group',
  component: InputGroup,
  subcomponents: { InputField },
  parameters: { controls: { disable: true }, fluidCanvas: { width: '34rem', minHeight: '16rem' } },
} satisfies Meta<typeof InputGroup>;

export default meta;
type Story = StoryObj;

export const Fields: Story = { render: () => <InputGroupExample /> };
export const ValidationError: Story = { render: () => <InputGroupExample error /> };
