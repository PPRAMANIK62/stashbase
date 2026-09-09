import type { AgentScope } from '@/features/agent/domain/session';
import type { SourceReference } from '@/shared/domain/source-reference';

/**
 * One file the Agent changed, as the runtime reported it. Claude and
 * OpenCode name the file and give the text on both sides; Codex names the
 * file and gives a unified patch; the server's own `file-diff` event gives
 * whole files with counts. Every runtime lands on this one shape so the
 * transcript renders one diff surface and one changed-files list.
 */
export type FileChangeAction = 'created' | 'wrote' | 'edited' | 'deleted' | 'changed';

export interface FileChangeText {
  before: string;
  after: string;
  /** Whether the texts are the whole file or only the edited fragment. */
  extent: 'file' | 'fragment';
}

export interface AgentFileChange {
  /** The path as the runtime reported it: absolute, or relative to the folder. */
  path: string;
  action: FileChangeAction;
  text?: FileChangeText;
  /** A unified patch, when that is all the runtime gave. */
  patch?: string;
  /** Line counts the server computed, when it did. */
  counts?: { additions: number; deletions: number };
}

export const FILE_CHANGE_ACTION_LABEL: Record<FileChangeAction, string> = {
  changed: 'Changed',
  created: 'Created',
  deleted: 'Deleted',
  edited: 'Edited',
  wrote: 'Wrote',
};

interface ToolLike {
  name: string;
  input: Record<string, unknown>;
  status?: string;
}

function argumentsOf(input: Record<string, unknown>): Record<string, unknown> {
  const nested = input.arguments;
  return nested && typeof nested === 'object' && !Array.isArray(nested)
    ? (nested as Record<string, unknown>)
    : input;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function pathOf(input: Record<string, unknown>): string {
  const candidate = [
    input.file_path,
    input.filePath,
    input.path,
    input.file,
    input.notebook_path,
  ].find((value): value is string => typeof value === 'string' && value.length > 0);
  return candidate ?? '';
}

function wholeFileAction(before: string, after: string): FileChangeAction {
  if (before === '' && after !== '') return 'created';
  if (after === '' && before !== '') return 'deleted';
  return 'changed';
}

function codexChange(item: unknown): AgentFileChange | null {
  if (!item || typeof item !== 'object') return null;
  const change = item as Record<string, unknown>;
  const path = pathOf(change);
  if (!path) return null;
  const rawKind = change.kind ?? change.type;
  const kind =
    typeof rawKind === 'string'
      ? rawKind
      : rawKind && typeof rawKind === 'object'
        ? text((rawKind as Record<string, unknown>).type)
        : '';
  const action: FileChangeAction =
    /^add/i.test(kind) || /create/i.test(kind)
      ? 'created'
      : /delete|remove/i.test(kind)
        ? 'deleted'
        : /update|modify|edit/i.test(kind)
          ? 'edited'
          : 'changed';
  const patch = text(change.diff ?? change.unified_diff ?? change.unifiedDiff);
  return { action, path, ...(patch ? { patch } : {}) };
}

/** The file changes a tool call describes, or none when it is not a write. */
export function fileChangesForTool(
  name: string,
  rawInput: Record<string, unknown>,
): AgentFileChange[] {
  const input = argumentsOf(rawInput);
  const path = pathOf(input);

  if (name === 'FileDiff') {
    if (!path) return [];
    const before = text(input.before);
    const after = text(input.after);
    const additions = typeof input.additions === 'number' ? input.additions : null;
    const deletions = typeof input.deletions === 'number' ? input.deletions : null;
    return [
      {
        action: wholeFileAction(before, after),
        path,
        text: { after, before, extent: 'file' },
        ...(additions !== null && deletions !== null ? { counts: { additions, deletions } } : {}),
      },
    ];
  }
  if (name === 'File change') {
    const changes = Array.isArray(input.changes) ? input.changes : [];
    return changes.flatMap((item) => codexChange(item) ?? []);
  }
  if (!path) return [];

  if (name === 'Edit' || /edit_file$/i.test(name)) {
    const before = text(input.old_string ?? input.old_text);
    const after = text(input.new_string ?? input.new_text);
    return [{ action: 'edited', path, text: { after, before, extent: 'fragment' } }];
  }
  if (name === 'MultiEdit') {
    const edits = Array.isArray(input.edits) ? input.edits : [];
    const changes = edits.flatMap((edit) => {
      if (!edit || typeof edit !== 'object') return [];
      const record = edit as Record<string, unknown>;
      return [
        {
          action: 'edited' as const,
          path,
          text: {
            after: text(record.new_string),
            before: text(record.old_string),
            extent: 'fragment' as const,
          },
        },
      ];
    });
    return changes.length > 0 ? changes : [{ action: 'edited', path }];
  }
  if (name === 'Write' || /write_file$/i.test(name)) {
    const after = text(input.content);
    return [{ action: 'wrote', path, text: { after, before: '', extent: 'file' } }];
  }
  if (name === 'NotebookEdit') return [{ action: 'edited', path }];
  if (/delete_file$/i.test(name)) return [{ action: 'deleted', path }];
  return [];
}

/** Every file a finished tool left changed, one entry per path with the
 *  latest action. Running, denied, failed, and cancelled work leaves none. */
export function settledFileChanges(tools: readonly ToolLike[]): AgentFileChange[] {
  const byPath = new Map<string, AgentFileChange>();
  for (const tool of tools) {
    if (tool.status !== 'done') continue;
    for (const change of fileChangesForTool(tool.name, tool.input)) {
      byPath.set(change.path, change);
    }
  }
  return [...byPath.values()];
}

function normalizeSeparators(path: string): string {
  return path.replace(/\\/g, '/');
}

/** The workspace source behind a changed path: a path already relative to
 *  the folder, or an absolute one inside it. A path outside the scoped
 *  folder, or any path in a Library chat, has no openable source. */
export function changedSource(scope: AgentScope, rawPath: string): SourceReference | null {
  if (scope.kind !== 'folder') return null;
  const folder = normalizeSeparators(scope.path).replace(/\/+$/u, '');
  const path = normalizeSeparators(rawPath);
  let relative: string;
  if (path === folder) return null;
  if (path.startsWith(`${folder}/`)) relative = path.slice(folder.length + 1);
  else if (/^([a-z]:)?\//iu.test(path)) return null;
  else relative = path.replace(/^\.\//u, '');
  if (relative === '' || relative.split('/').some((part) => part === '' || part === '..')) {
    return null;
  }
  return { folderPath: scope.path, path: relative };
}

export function fileBasename(path: string): string {
  const normalized = normalizeSeparators(path).replace(/\/+$/u, '');
  return normalized.slice(normalized.lastIndexOf('/') + 1) || path;
}
