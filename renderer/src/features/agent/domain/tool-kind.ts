/** What a tool call is, read from its name alone. The transcript spells a
 *  row's verb and icon from it, and a settled turn asks it which calls could
 *  have changed the folder without saying so. */
import { QUESTION_TOOL_NAME } from '@/features/agent/domain/question';

export type AgentToolKind =
  | 'read'
  | 'list'
  | 'search'
  | 'command'
  | 'write'
  | 'edit'
  | 'question'
  | 'other';

export function agentToolKind(name: string): AgentToolKind {
  if (name === QUESTION_TOOL_NAME) return 'question';
  if (name === 'Bash' || /command|shell|exec/i.test(name)) return 'command';
  if (/read_file$/i.test(name) || /^read$/i.test(name)) return 'read';
  if (/write_file$/i.test(name) || /^write$/i.test(name)) return 'write';
  if (/edit_file$/i.test(name) || /file change/i.test(name)) return 'edit';
  if (/^(?:edit|multiedit|notebookedit|filediff)$/i.test(name)) return 'edit';
  if (/list_directory$/i.test(name) || /^list/i.test(name)) return 'list';
  if (/search|grep|find/i.test(name)) return 'search';
  return 'other';
}
