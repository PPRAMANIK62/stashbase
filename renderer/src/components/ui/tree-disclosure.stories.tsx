import type { Meta, StoryObj } from '@storybook/react-vite';

import { FileTypeIcon } from './file-type-icon';
import { TreeDisclosure } from './tree-disclosure';

const files = ['overview.md', 'principles.md', 'user-journeys.md'];

const meta = {
  title: 'Navigation/Tree Disclosure',
  component: TreeDisclosure,
  parameters: { controls: { disable: true }, fluidCanvas: { width: '24rem', minHeight: '14rem' } },
} satisfies Meta<typeof TreeDisclosure>;

export default meta;
type Story = StoryObj;

/** One collapsible branch: a quiet caption-weight trigger and an indented
 *  panel joined to it by a hairline. */
export const Branch: Story = {
  render: () => (
    <div className="w-full">
      <TreeDisclosure label="design-docs">
        {files.map((name) => (
          <div className="flex h-7 items-center gap-1.5 px-2 text-body" key={name}>
            <FileTypeIcon
              aria-hidden="true"
              className="size-4 shrink-0 text-muted-foreground"
              path={name}
            />
            <span className="truncate">{name}</span>
          </div>
        ))}
      </TreeDisclosure>
    </div>
  ),
};

/** Branches stack without any wrapper of their own. */
export const Stacked: Story = {
  render: () => (
    <div className="flex w-full flex-col gap-1">
      <TreeDisclosure label="design-docs">
        <div className="h-7 px-2 text-body">overview.md</div>
      </TreeDisclosure>
      <TreeDisclosure label="code-review">
        <div className="h-7 px-2 text-body">architecture.md</div>
      </TreeDisclosure>
    </div>
  ),
};
