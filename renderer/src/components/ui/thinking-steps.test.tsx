import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { expectNoA11yViolations } from '@/test/axe';

import {
  ThinkingStep,
  ThinkingStepDetails,
  ThinkingStepSource,
  ThinkingStepSources,
  ThinkingSteps,
  ThinkingStepsContent,
  ThinkingStepsHeader,
} from './thinking-steps';

afterEach(cleanup);

function RetrievalTrace() {
  return (
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
          <ThinkingStepDetails details={['Kept 3 high-confidence sources.']} summary="Details" />
          <ThinkingStepSources>
            <ThinkingStepSource color="blue">Project overview.md</ThinkingStepSource>
          </ThinkingStepSources>
        </ThinkingStep>
      </ThinkingStepsContent>
    </ThinkingSteps>
  );
}

describe('ThinkingSteps', () => {
  it('shows the trace open and collapses it from the header', async () => {
    const view = render(<RetrievalTrace />);
    expect(screen.getByText('Searching workspace')).toBeDefined();
    const header = screen.getByRole('button', { name: /Tracing answer/ });
    expect(header.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(header);
    expect(header.getAttribute('aria-expanded')).toBe('false');
    await expectNoA11yViolations(view.container);
  });

  it("lists a step's sources as badges beside it", async () => {
    const view = render(<RetrievalTrace />);
    expect(screen.getByText('Project overview.md')).toBeDefined();
    await expectNoA11yViolations(view.container);
  });
});
