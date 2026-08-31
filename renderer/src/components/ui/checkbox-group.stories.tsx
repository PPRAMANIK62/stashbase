import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { CheckboxGroup, CheckboxItem } from './checkbox-group';

function CheckboxExample() {
  const [checkedIndices, setCheckedIndices] = useState(new Set([0]));
  const choices = [
    ['markdown', 'Markdown'],
    ['pdf', 'PDF'],
    ['images', 'Images'],
  ] as const;

  return (
    <CheckboxGroup checkedIndices={checkedIndices} aria-label="File formats">
      {choices.map(([value, label], index) => (
        <CheckboxItem
          checked={checkedIndices.has(index)}
          index={index}
          key={value}
          label={label}
          onToggle={() =>
            setCheckedIndices((current) => {
              const next = new Set(current);
              if (next.has(index)) next.delete(index);
              else next.add(index);
              return next;
            })
          }
        />
      ))}
    </CheckboxGroup>
  );
}

const meta = {
  title: 'Inputs/Checkbox Group',
  component: CheckboxGroup,
  subcomponents: { CheckboxItem },
  parameters: { controls: { disable: true }, fluidCanvas: { width: '28rem', minHeight: '18rem' } },
} satisfies Meta<typeof CheckboxGroup>;

export default meta;
type Story = StoryObj;

export const MultipleSelection: Story = { render: () => <CheckboxExample /> };
