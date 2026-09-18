import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { agentQuestions } from '@/features/agent/domain/question';

import { AgentQuestionCard, AgentQuestionSummary } from './question-card';
import type { AgentToolBlock } from './tool-presentation';

const ask: AgentToolBlock = {
  id: 'tool-1',
  input: {
    questions: [
      {
        header: 'Publish?',
        multiSelect: false,
        options: [
          { description: 'Move the draft and push.', label: 'Publish now' },
          { description: 'Keep drafting.', label: 'Hold' },
        ],
        question: 'Publish the post now?',
      },
      {
        header: 'Sections',
        multiSelect: true,
        options: [
          { description: '', label: 'Introduction' },
          { description: '', label: 'Conclusion' },
        ],
        question: 'Which sections should I include?',
      },
    ],
  },
  kind: 'tool',
  name: 'AskUserQuestion',
  permissionId: 'permission-1',
  permissionRequested: true,
  permissionTitle: null,
  status: 'awaiting',
};
const questions = agentQuestions(ask.name, ask.input) ?? [];

afterEach(cleanup);

describe('Agent question card', () => {
  it('sends every answer keyed by its question, joined the way the runtime reads them', async () => {
    const onReply = vi.fn(() => true);
    render(<AgentQuestionCard onReply={onReply} questions={questions} tool={ask} />);
    const answer = screen.getByRole('button', { name: 'Answer' });
    expect(answer.hasAttribute('disabled')).toBe(true);
    await userEvent.click(screen.getByRole('radio', { name: /Publish now/u }));
    expect(answer.hasAttribute('disabled')).toBe(true);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Introduction' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Conclusion' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Other' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Your answer' }), 'Appendix{Enter}');
    expect(onReply).toHaveBeenCalledWith('tool-1', 'permission-1', true, {
      answers: {
        'Publish the post now?': 'Publish now',
        'Which sections should I include?': 'Introduction, Conclusion, Appendix',
      },
    });
  });

  it('lets the reader type an answer of their own in place of an option', async () => {
    const onReply = vi.fn(() => true);
    render(<AgentQuestionCard onReply={onReply} questions={questions.slice(0, 1)} tool={ask} />);
    expect(screen.getByRole('heading', { name: 'Publish the post now?' })).not.toBeNull();
    await userEvent.click(screen.getByRole('radio', { name: /^Hold/u }));
    await userEvent.click(screen.getByRole('radio', { name: 'Other' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Your answer' }), 'Tomorrow morning');
    await userEvent.click(screen.getByRole('button', { name: 'Answer' }));
    expect(onReply).toHaveBeenCalledWith('tool-1', 'permission-1', true, {
      answers: { 'Publish the post now?': 'Tomorrow morning' },
    });
  });

  it('lets the reader skip, and reads an answered call back behind its row', async () => {
    const onReply = vi.fn(() => true);
    render(<AgentQuestionCard onReply={onReply} questions={questions} tool={ask} />);
    await userEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(onReply).toHaveBeenCalledWith('tool-1', 'permission-1', false);
    cleanup();
    render(
      <AgentQuestionSummary answers={{ 'Publish the post now?': 'Hold' }} questions={questions} />,
    );
    expect(screen.getByText('Hold')).not.toBeNull();
    expect(screen.getByText('Not answered')).not.toBeNull();
  });
});
