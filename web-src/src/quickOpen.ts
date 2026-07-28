export interface QuickOpenItem {
  path: string;
  basename: string;
  recent: boolean;
  score: number;
}

const basename = (path: string) => path.split('/').pop() ?? path;

/** A small deterministic fuzzy ranker. Basename matches win over path-only
 * matches; contiguous and early matches win within either field. */
function fuzzyScore(value: string, query: string): number | null {
  let cursor = 0;
  let score = 0;
  let previous = -2;
  for (const char of query.toLocaleLowerCase()) {
    const index = value.toLocaleLowerCase().indexOf(char, cursor);
    if (index < 0) return null;
    score += 10 - Math.min(index, 8);
    if (index === previous + 1) score += 12;
    previous = index;
    cursor = index + 1;
  }
  return score;
}

export function rankQuickOpen(paths: string[], query: string, recentPaths: string[]): QuickOpenItem[] {
  const normalized = query.trim();
  const recentRank = new Map(recentPaths.map((path, index) => [path, index]));
  if (!normalized) {
    return recentPaths
      .filter((path, index) => paths.includes(path) && recentPaths.indexOf(path) === index)
      .map((path, index) => ({ path, basename: basename(path), recent: true, score: -index }));
  }
  return paths
    .map((path) => {
      const nameScore = fuzzyScore(basename(path), normalized);
      const pathScore = fuzzyScore(path, normalized);
      if (nameScore == null && pathScore == null) return null;
      return { path, basename: basename(path), recent: recentRank.has(path), score: Math.max(nameScore ?? -Infinity, (pathScore ?? -Infinity) - 8) };
    })
    .filter((item): item is QuickOpenItem => item !== null)
    .sort((a, b) => b.score - a.score || a.basename.localeCompare(b.basename) || a.path.localeCompare(b.path));
}
