import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import { SizeProvider } from '@/lib/size-context';

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

/** Closed at rest, which is how a settled turn shows its trace: the header is
 *  the disclosure, and the play here opens it so the expanded body is what
 *  gets scored rather than the shell in front of it. */
export const Collapsed: Story = {
  render: () => (
    <ThinkingSteps defaultOpen={false}>
      <ThinkingStepsHeader>Thought for 4 seconds</ThinkingStepsHeader>
      <ThinkingStepsContent>
        <ThinkingStep
          description="Matched document titles and extracted text."
          icon="search"
          label="Searching workspace"
          status="complete"
        />
        <ThinkingStep icon="check" isLast label="Answered" status="complete" />
      </ThinkingStepsContent>
    </ThinkingSteps>
  ),
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button', { name: /Thought for 4 seconds/ });
    await userEvent.click(trigger);
    await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'true'));
  },
};

/** A trace still running. The steps after the active one read as pending, so
 *  the reader can see what is still to come rather than only what has landed. */
export const InProgress: Story = {
  render: () => (
    <ThinkingSteps defaultOpen>
      <ThinkingStepsHeader>Tracing answer</ThinkingStepsHeader>
      <ThinkingStepsContent>
        <ThinkingStep
          description="Matched 42 documents."
          icon="search"
          label="Searching workspace"
          status="complete"
        />
        <ThinkingStep icon="brain" label="Ranking evidence" status="active" />
        <ThinkingStep icon="dot" isLast label="Writing response" status="pending" />
      </ThinkingStepsContent>
    </ThinkingSteps>
  ),
};

/** The compact step: one notch down in type and row height, for the trace
 *  inside a narrow agent panel. */
export const Compact: Story = {
  render: () => (
    <SizeProvider size="compact">
      <ThinkingSteps defaultOpen>
        <ThinkingStepsHeader>Tracing answer</ThinkingStepsHeader>
        <ThinkingStepsContent>
          <ThinkingStep
            description="Matched document titles and extracted text."
            icon="search"
            label="Searching workspace"
            status="complete"
          />
          <ThinkingStep icon="dot" isLast label="Writing response" status="active">
            <ThinkingStepSources>
              <ThinkingStepSource color="blue">Project overview.md</ThinkingStepSource>
            </ThinkingStepSources>
          </ThinkingStep>
        </ThinkingStepsContent>
      </ThinkingSteps>
    </SizeProvider>
  ),
};
