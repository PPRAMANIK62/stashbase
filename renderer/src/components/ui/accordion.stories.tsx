import type { Meta, StoryObj } from '@storybook/react-vite';

import { AccordionContent, AccordionGroup, AccordionItem, AccordionTrigger } from './accordion';

const meta = {
  title: 'Navigation/Accordion',
  component: AccordionGroup,
  subcomponents: { AccordionItem, AccordionTrigger, AccordionContent },
  parameters: { fluidCanvas: { width: '36rem', minHeight: '20rem' }, layout: 'padded' },
} satisfies Meta<typeof AccordionGroup>;

export default meta;
type Story = StoryObj;

export const Single: Story = {
  render: () => (
    <AccordionGroup className="mx-auto max-w-2xl" collapsible defaultValue="scope" type="single">
      <AccordionItem index={0} value="scope">
        <AccordionTrigger>What does StashBase index?</AccordionTrigger>
        <AccordionContent>
          Only files inside the project folders you explicitly add to the workspace.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem index={1} value="privacy">
        <AccordionTrigger>Where does document data live?</AccordionTrigger>
        <AccordionContent>
          Source documents remain local, and derived search data belongs to the local index.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem index={2} value="formats">
        <AccordionTrigger>Which formats are supported?</AccordionTrigger>
        <AccordionContent>
          Markdown, text, PDF, office documents, images, and audio.
        </AccordionContent>
      </AccordionItem>
    </AccordionGroup>
  ),
};

export const Multiple: Story = {
  render: () => (
    <AccordionGroup
      className="mx-auto max-w-2xl"
      defaultValue={['prepare', 'search']}
      type="multiple"
    >
      <AccordionItem index={0} value="prepare">
        <AccordionTrigger>Preparation</AccordionTrigger>
        <AccordionContent>
          Extract searchable text while preserving the original file.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem index={1} value="search">
        <AccordionTrigger>Search</AccordionTrigger>
        <AccordionContent>
          Combine keyword and semantic retrieval across the workspace.
        </AccordionContent>
      </AccordionItem>
    </AccordionGroup>
  ),
};
