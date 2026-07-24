import type { FileMeta, FolderMeta } from '../../apiTypes';

export type MentionSuggestion = { path: string; kind: 'file' | 'folder' };

/** Rank the workspace item a person is most likely typing and keep ties stable. */
export function rankMentionSuggestions(
  files: FileMeta[],
  folders: FolderMeta[],
  query: string,
  limit = 8,
): MentionSuggestion[] {
  const needle = query.trim().toLowerCase();
  const suggestions = [
    ...files.map((file) => ({ path: file.name, kind: 'file' as const })),
    ...folders.map((folder) => ({ path: folder.path, kind: 'folder' as const })),
  ];
  return suggestions
    .map((suggestion) => ({ suggestion, score: mentionScore(suggestion.path, needle) }))
    .filter((candidate): candidate is { suggestion: MentionSuggestion; score: number } => candidate.score !== null)
    .sort((a, b) => a.score - b.score
      || baseName(a.suggestion.path).length - baseName(b.suggestion.path).length
      || a.suggestion.path.localeCompare(b.suggestion.path))
    .slice(0, limit)
    .map((candidate) => candidate.suggestion);
}

function mentionScore(path: string, query: string): number | null {
  if (!query) return 5;
  const fileName = baseName(path).toLowerCase();
  const lowerPath = path.toLowerCase();
  if (fileName === query) return 0;
  if (fileName.startsWith(query)) return 1;
  if (lowerPath.startsWith(query)) return 2;
  if (fileName.includes(query)) return 3;
  if (lowerPath.includes(query)) return 4;
  return null;
}

function baseName(path: string): string {
  return path.split('/').pop() ?? path;
}
