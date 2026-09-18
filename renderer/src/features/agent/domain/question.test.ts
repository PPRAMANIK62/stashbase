import { describe, expect, it } from 'vite-plus/test';

import { agentQuestionAnswers, agentQuestionReplies, agentQuestions } from './question';

const questions = [
  {
    header: 'Publish?',
    multiSelect: false,
    options: [
      { description: 'Move the draft and push.', label: 'Publish now' },
      { description: 'Keep it in drafts.', label: 'Hold' },
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
];

describe('Agent clarifying questions', () => {
  it('reads the question tool and leaves other calls and malformed questions alone', () => {
    expect(agentQuestions('AskUserQuestion', { questions })).toEqual(questions);
    expect(
      agentQuestions('AskUserQuestion', {
        questions: [{ ...questions[0], header: 7, options: [{ label: 'Only' }] }],
      }),
    ).toEqual([{ ...questions[0], header: '', options: [{ description: '', label: 'Only' }] }]);
    expect(agentQuestions('Bash', { questions })).toBeNull();
    expect(agentQuestions('AskUserQuestion', { questions: [] })).toBeNull();
    expect(
      agentQuestions('AskUserQuestion', { questions: [{ options: [], question: 'Which?' }] }),
    ).toBeNull();
    expect(
      agentQuestions('AskUserQuestion', {
        questions: [{ options: [{ label: '' }], question: 'Which?' }],
      }),
    ).toBeNull();
  });

  it('joins choices the way the runtime reads them and holds until every question has one', () => {
    expect(
      agentQuestionReplies(questions, [
        { labels: ['Publish now'], other: null },
        { labels: [], other: null },
      ]),
    ).toBeNull();
    expect(
      agentQuestionReplies(questions, [
        { labels: [], other: '   ' },
        { labels: ['Introduction'], other: null },
      ]),
    ).toBeNull();
    expect(
      agentQuestionReplies(questions, [
        { labels: [], other: 'Publish tomorrow morning' },
        { labels: ['Introduction', 'Conclusion'], other: 'Appendix' },
      ]),
    ).toEqual({
      'Publish the post now?': 'Publish tomorrow morning',
      'Which sections should I include?': 'Introduction, Conclusion, Appendix',
    });
  });

  it('reads the answers a settled call carries back', () => {
    expect(
      agentQuestionAnswers({ answers: { 'Publish the post now?': 'Hold', skipped: 3 }, questions }),
    ).toEqual({ 'Publish the post now?': 'Hold' });
    expect(agentQuestionAnswers({ questions })).toBeNull();
    expect(agentQuestionAnswers({ answers: {} })).toBeNull();
  });
});
