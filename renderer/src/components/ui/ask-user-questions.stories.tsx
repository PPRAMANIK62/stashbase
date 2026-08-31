import type { Meta, StoryObj } from '@storybook/react-vite';

import { AskUserQuestions } from './ask-user-questions';

const meta = {
  title: 'Agent Patterns/Ask User Questions',
  component: AskUserQuestions,
  parameters: {
    controls: { disable: true },
    fluidCanvas: { width: '44rem', minHeight: '36rem' },
    layout: 'padded',
  },
} satisfies Meta<typeof AskUserQuestions>;

export default meta;
type Story = StoryObj;

export const GuidedSetup: Story = {
  render: () => (
    <AskUserQuestions
      questions={[
        {
          id: 'scope',
          title: 'What should this workspace include?',
          options: [
            { id: 'project', title: 'Current project', description: 'One focused folder' },
            { id: 'workspace', title: 'Workspace', description: 'Several related folders' },
            { id: 'archive', title: 'Archive', description: 'Existing reference material' },
          ],
        },
        {
          id: 'goals',
          multiSelect: true,
          nextLabel: 'Continue',
          title: 'What should StashBase help with?',
          options: [
            { id: 'search', title: 'Search and retrieval' },
            { id: 'prepare', title: 'Document preparation' },
            { id: 'agent', title: 'Agent-assisted work' },
          ],
        },
      ]}
    />
  ),
};
