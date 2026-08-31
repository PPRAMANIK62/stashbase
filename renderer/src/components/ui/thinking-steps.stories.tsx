import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  ThinkingStep,
  ThinkingStepDetails,
  ThinkingStepSource,
  ThinkingStepSources,
  ThinkingSteps,
  ThinkingStepsContent,
  ThinkingStepsHeader,
} from './thinking-steps';

const meta = {
  title: 'Feedback/Thinking Steps',
  component: ThinkingSteps,
  subcomponents: { ThinkingStepsHeader, ThinkingStepsContent, ThinkingStep },
  parameters: { controls: { disable: true }, fluidCanvas: { width: '38rem', minHeight: '26rem' } },
} satisfies Meta<typeof ThinkingSteps>;

export default meta;
type Story = StoryObj;

export const RetrievalTrace: Story = {
  render: () => (
    <ThinkingSteps defaultOpen>
      <ThinkingStepsHeader>Tracing answer</ThinkingStepsHeader>
      <ThinkingStepsContent>
        <ThinkingStep
          description="Matched document titles and extracted text."
          icon="search"
          label="Searching workspace"
          status="complete"
        />
        <ThinkingStep
          description="Compared sources against the question."
          icon="brain"
          label="Evaluating evidence"
          status="complete"
        >
          <ThinkingStepDetails
            details={['Found 8 relevant passages.', 'Kept 3 high-confidence sources.']}
            summary="Show details"
          />
        </ThinkingStep>
        <ThinkingStep icon="dot" isLast label="Writing response" status="active">
          <ThinkingStepSources>
            <ThinkingStepSource color="blue">Project overview.md</ThinkingStepSource>
            <ThinkingStepSource color="gray">Research notes.pdf</ThinkingStepSource>
          </ThinkingStepSources>
        </ThinkingStep>
      </ThinkingStepsContent>
    </ThinkingSteps>
  ),
};
