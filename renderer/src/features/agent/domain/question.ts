/** An Agent's clarifying questions, as the question tool carries them. The
 *  runtime hands the renderer the tool's input, the reader chooses, and the
 *  answers travel back on the same reply an approval does, keyed by question
 *  text, which is how the runtime reads them. Claude's AskUserQuestion is the
 *  shape; the OpenCode adapter names its question tool the same. What a
 *  question means is decided here; the transcript decides how it is asked. */

export const QUESTION_TOOL_NAME = 'AskUserQuestion';

export interface AgentQuestionOption {
  label: string;
  description: string;
}

export interface AgentQuestion {
  question: string;
  /** A short tag for the question — "Format", "Publish?" — or empty. */
  header: string;
  options: AgentQuestionOption[];
  multiSelect: boolean;
}

export type AgentQuestionAnswers = Record<string, string>;

/** What the reader chose on one question: the options ticked, and the text
 *  typed where none of them fit. `other` is null until the reader takes that
 *  line, so a line opened and left empty still counts as no answer. */
export interface AgentQuestionChoice {
  labels: string[];
  other: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseOption(value: unknown): AgentQuestionOption | null {
  if (!isRecord(value) || typeof value.label !== 'string' || !value.label.trim()) return null;
  return {
    description: typeof value.description === 'string' ? value.description : '',
    label: value.label,
  };
}

function parseQuestion(value: unknown): AgentQuestion | null {
  if (!isRecord(value) || typeof value.question !== 'string' || !value.question.trim()) return null;
  if (!Array.isArray(value.options) || value.options.length === 0) return null;
  const options: AgentQuestionOption[] = [];
  for (const option of value.options) {
    const parsed = parseOption(option);
    if (!parsed) return null;
    options.push(parsed);
  }
  return {
    header: typeof value.header === 'string' ? value.header.trim() : '',
    multiSelect: value.multiSelect === true,
    options,
    question: value.question,
  };
}

/** The questions a tool call puts to the reader, or null when the call is
 *  not a question tool or its questions cannot be offered as choices — a
 *  malformed call takes the plain approval card instead. */
export function agentQuestions(
  name: string,
  input: Record<string, unknown>,
): AgentQuestion[] | null {
  if (name !== QUESTION_TOOL_NAME || !Array.isArray(input.questions)) return null;
  if (input.questions.length === 0) return null;
  const questions: AgentQuestion[] = [];
  for (const question of input.questions) {
    const parsed = parseQuestion(question);
    if (!parsed) return null;
    questions.push(parsed);
  }
  return questions;
}

/** The answers a question call already carries, keyed by question text. */
export function agentQuestionAnswers(input: Record<string, unknown>): AgentQuestionAnswers | null {
  if (!isRecord(input.answers)) return null;
  const answers: AgentQuestionAnswers = {};
  for (const [question, answer] of Object.entries(input.answers)) {
    if (typeof answer === 'string') answers[question] = answer;
  }
  return Object.keys(answers).length > 0 ? answers : null;
}

/** One answer as the runtime reads it: the ticked labels, then the reader's
 *  own text, joined the way the SDK joins a multi-select. Empty when the
 *  reader chose nothing. */
function agentQuestionAnswer(choice: AgentQuestionChoice): string {
  const other = choice.other?.trim() ?? '';
  return [...choice.labels, ...(other ? [other] : [])].join(', ');
}

/** Every question answered, keyed by its text, or null while one is still
 *  open — which is what keeps the card from sending. */
export function agentQuestionReplies(
  questions: readonly AgentQuestion[],
  choices: readonly AgentQuestionChoice[],
): AgentQuestionAnswers | null {
  const answers: AgentQuestionAnswers = {};
  for (const [index, question] of questions.entries()) {
    const choice = choices[index];
    const answer = choice ? agentQuestionAnswer(choice) : '';
    if (!answer) return null;
    answers[question.question] = answer;
  }
  return answers;
}
