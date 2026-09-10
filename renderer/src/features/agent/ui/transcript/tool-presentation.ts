import type { AgentTranscriptBlock } from '@/features/agent/domain/session';

export type AgentToolBlock = Extract<AgentTranscriptBlock, { kind: 'tool' }>;
export type AgentToolKind = 'read' | 'list' | 'search' | 'command' | 'write' | 'edit' | 'other';

const PAYLOAD_LINE_LIMIT = 14;
const PAYLOAD_CHARACTER_LIMIT = 1_200;
const RESULT_CHARACTER_LIMIT = 4_000;

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

function basename(path: string): string {
  const normalized = path.replace(/[\\/]+$/u, '');
  return normalized.split(/[\\/]/u).at(-1) || path;
}

export function agentToolKind(tool: AgentToolBlock): AgentToolKind {
  if (tool.name === 'Bash' || /command|shell|exec/i.test(tool.name)) return 'command';
  if (/read_file$/i.test(tool.name) || /^read$/i.test(tool.name)) return 'read';
  if (/write_file$/i.test(tool.name) || /^write$/i.test(tool.name)) return 'write';
  if (/edit_file$/i.test(tool.name) || /file change/i.test(tool.name)) return 'edit';
  if (/^(?:edit|multiedit|notebookedit|filediff)$/i.test(tool.name)) return 'edit';
  if (/list_directory$/i.test(tool.name) || /^list/i.test(tool.name)) return 'list';
  if (/search|grep|find/i.test(tool.name)) return 'search';
  return 'other';
}

export function agentToolRow(tool: AgentToolBlock): {
  mono?: boolean;
  target?: string | undefined;
  verb: string;
} {
  const input = argumentsOf(tool.input);
  const kind = agentToolKind(tool);
  const rawPath = input.path ?? input.file_path ?? input.file;
  const path = typeof rawPath === 'string' ? basename(rawPath) : undefined;
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
    case 'other':
      return { verb: tool.name };
  }
}

export function agentPermissionTitle(tool: AgentToolBlock): string {
  if (tool.permissionTitle) return tool.permissionTitle;
  switch (agentToolKind(tool)) {
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

export function agentActivitySummary(tools: AgentToolBlock[], active: boolean): string {
  const counts = new Map<AgentToolKind, number>();
  for (const tool of tools) {
    const kind = agentToolKind(tool);
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
    countLabel(counts.get('other'), 'Used tool', 'Used tools'),
  ].filter((label): label is string => Boolean(label));
  const summary = labels.length > 0 ? labels.join(', ') : 'Worked';
  return active ? `${summary}…` : summary;
}

function countLabel(count: number | undefined, singular: string, plural: string): string | null {
  if (!count) return null;
  return count === 1 ? singular : plural;
}
