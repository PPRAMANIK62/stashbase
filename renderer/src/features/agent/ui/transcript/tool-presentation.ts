/** What a tool call reads as: the verb and target on its row, the header its
 *  group carries while the work moves and once it settles, the title on a
 *  permission ask, and the bounded arguments and result behind an opened row.
 *  Wording only — whether a call is shown at all, and which group is still
 *  live, are decided by the surfaces in `activity.tsx`. */
import { agentQuestions } from '@/features/agent/domain/question';
import type { AgentTranscriptBlock } from '@/features/agent/domain/session';
import { agentToolKind, type AgentToolKind } from '@/features/agent/domain/tool-kind';
import { basePathName } from '@/shared/utils/file-path';

export type AgentToolBlock = Extract<AgentTranscriptBlock, { kind: 'tool' }>;

/** What a call's status reads as, on its row and on a decided card. */
export const STATUS_LABELS: Record<AgentToolBlock['status'], string> = {
  awaiting: 'Waiting for approval',
  cancelled: 'Cancelled',
  denied: 'Denied',
  done: 'Done',
  error: 'Failed',
  running: 'Running',
};

const PAYLOAD_LINE_LIMIT = 14;
const PAYLOAD_CHARACTER_LIMIT = 1_200;
const RESULT_CHARACTER_LIMIT = 4_000;
/** A header names one step on one line, so a long command stops here. */
const HEADLINE_TARGET_LIMIT = 48;

function argumentsOf(input: Record<string, unknown>): Record<string, unknown> {
  const nested = input.arguments;
  return nested && typeof nested === 'object' && !Array.isArray(nested)
    ? (nested as Record<string, unknown>)
    : input;
}

function clipText(value: string, characterLimit: number): string {
  const lines = value.split('\n');
  let output = lines.slice(0, PAYLOAD_LINE_LIMIT).join('\n');
  if (output.length > characterLimit) output = output.slice(0, characterLimit);
  return output.length < value.length
    ? `${output}\n… (+${(value.length - output.length).toLocaleString()} characters)`
    : output;
}

export function agentToolRow(tool: AgentToolBlock): {
  mono?: boolean;
  target?: string | undefined;
  verb: string;
} {
  const input = argumentsOf(tool.input);
  const kind = agentToolKind(tool.name);
  const rawPath = input.path ?? input.file_path ?? input.file;
  const path = typeof rawPath === 'string' ? basePathName(rawPath) : undefined;
  switch (kind) {
    case 'read':
      return { target: path, verb: path ? 'Read' : 'Read a file' };
    case 'write':
      return { target: path, verb: path ? 'Wrote' : 'Wrote a file' };
    case 'edit':
      if (tool.name === 'FileDiff') return { target: path, verb: 'Changed' };
      return { target: path, verb: path ? 'Edited' : 'Edited a file' };
    case 'list':
      return { target: path, verb: 'Listed files' };
    case 'search': {
      const query = input.query ?? input.pattern;
      return {
        mono: typeof query === 'string',
        target: typeof query === 'string' ? query.slice(0, 120) : undefined,
        verb: 'Searched',
      };
    }
    case 'command': {
      const command = input.command;
      return {
        mono: typeof command === 'string',
        target: typeof command === 'string' ? command.slice(0, 120) : undefined,
        verb: 'Ran',
      };
    }
    case 'question': {
      const first = agentQuestions(tool.name, tool.input)?.[0];
      return first
        ? { target: first.question.slice(0, 120), verb: 'Asked' }
        : { verb: 'Asked a question' };
    }
    case 'other':
      return { verb: tool.name };
  }
}

export function agentPermissionTitle(tool: AgentToolBlock): string {
  if (tool.permissionTitle) return tool.permissionTitle;
  switch (agentToolKind(tool.name)) {
    case 'command':
      return 'Run this command?';
    case 'write':
    case 'edit':
      return 'Apply these changes?';
    default:
      return `Allow ${tool.name}?`;
  }
}

export function agentToolPayload(input: Record<string, unknown>): string {
  const entries = Object.entries(argumentsOf(input)).flatMap(([key, value]) => {
    if (value === null || value === undefined || value === '') return [];
    if (typeof value === 'string') {
      const text = clipText(value, PAYLOAD_CHARACTER_LIMIT);
      return [text.includes('\n') || text.length > 100 ? `${key}:\n${text}` : `${key}: ${text}`];
    }
    let serialized: string;
    try {
      serialized = JSON.stringify(value, null, 2);
    } catch {
      serialized = String(value);
    }
    return [`${key}: ${clipText(serialized, PAYLOAD_CHARACTER_LIMIT)}`];
  });
  if (entries.length > 0) return entries.join('\n\n');
  try {
    return clipText(JSON.stringify(input, null, 2), PAYLOAD_CHARACTER_LIMIT);
  } catch {
    return '[Arguments could not be displayed]';
  }
}

export function agentToolResult(result: string): string {
  return result.length > RESULT_CHARACTER_LIMIT
    ? `${result.slice(0, RESULT_CHARACTER_LIMIT)}\n… (result truncated)`
    : result;
}

/** The step a moving group is on, named the way its own row names it. A long
 *  command is clipped, and the trailing ellipsis is both the unfinished mark
 *  and the clip mark, so the header never ends in two of them. */
function agentCurrentStep(tools: AgentToolBlock[]): string | null {
  // A call that was refused or interrupted is not the step in hand, and the
  // group shows its outcome on its own row rather than in the header.
  const current =
    tools.findLast((tool) => tool.status === 'running') ??
    tools.findLast((tool) => tool.status === 'done');
  if (!current) return null;
  const { target, verb } = agentToolRow(current);
  if (!target) return `${verb}…`;
  const clipped =
    target.length > HEADLINE_TARGET_LIMIT
      ? target.slice(0, HEADLINE_TARGET_LIMIT).trimEnd()
      : target;
  return `${verb} ${clipped}…`;
}

/** The group's header: while the turn is still moving, the step in hand, so a
 *  reader watching a long turn sees the work advance rather than one count
 *  that holds still for minutes. Once it settles, the group at a glance. */
export function agentActivitySummary(tools: AgentToolBlock[], active: boolean): string {
  const step = active ? agentCurrentStep(tools) : null;
  if (step) return step;
  const counts = new Map<AgentToolKind, number>();
  for (const tool of tools) {
    const kind = agentToolKind(tool.name);
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  const labels = [
    countLabel(counts.get('read'), 'Read file', 'Read files'),
    countLabel(counts.get('list'), 'Listed folder', 'Listed folders'),
    counts.get('search') ? 'Searched' : null,
    countLabel(counts.get('command'), 'Ran command', 'Ran commands'),
    countLabel(
      (counts.get('write') ?? 0) + (counts.get('edit') ?? 0),
      'Edited file',
      'Edited files',
    ),
    countLabel(counts.get('question'), 'Asked a question', 'Asked questions'),
    countLabel(counts.get('other'), 'Used tool', 'Used tools'),
  ].filter((label): label is string => Boolean(label));
  const summary = labels.length > 0 ? labels.join(', ') : 'Worked';
  return active ? `${summary}…` : summary;
}

function countLabel(count: number | undefined, singular: string, plural: string): string | null {
  if (!count) return null;
  return count === 1 ? singular : plural;
}
