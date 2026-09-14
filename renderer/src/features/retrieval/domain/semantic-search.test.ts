import { describe, expect, it } from 'vite-plus/test';

import {
  groupSemanticHits,
  semanticHitId,
  semanticNavigationIntent,
  semanticSnippet,
  type SemanticHit,
} from './semantic-search';

function hit(folderPath: string, path: string, score: number, chunkIndex = 0): SemanticHit {
  const source = { folderPath, path };
  return {
    chunkIndex,
    content: `# Heading\n\nFirst useful line of ${path}.\nSecond line.`,
    heading: 'Heading',
    id: semanticHitId(source, chunkIndex),
    score,
    snippet: semanticSnippet(`First useful line of ${path}.`),
    source,
    startLine: 3,
  };
}

describe('semantic search domain', () => {
  it('bounds the snippet and collapses whitespace without touching the raw content', () => {
    const long = `line one\n\n   ${'x'.repeat(400)}`;
    const snippet = semanticSnippet(long);
    expect(snippet.length).toBe(200);
    expect(snippet.startsWith('line one x')).toBe(true);
    expect(snippet.endsWith('…')).toBe(true);
  });

  it('keeps rank order inside the requested folder and drops invalid cross-folder hits', () => {
    const hits = [
      hit('/project/b', 'one.md', 0.9),
      hit('/project/a', 'two.md', 0.8),
      hit('/project/b', 'three.md', 0.7),
    ];
    expect(groupSemanticHits(hits, '/project/b').map((group) => group.folderPath)).toEqual([
      '/project/b',
    ]);
    expect(
      groupSemanticHits(hits, '/project/b')[0]?.hits.map((entry) => entry.source.path),
    ).toEqual(['one.md', 'three.md']);
    expect(groupSemanticHits(hits, '/project/a')[0]?.hits).toHaveLength(1);
    expect(groupSemanticHits([], '/project/a')).toEqual([]);
  });

  it('anchors navigation on the first non-heading line of the chunk', () => {
    const intent = semanticNavigationIntent({ ...hit('/project/a', 'two.md', 1), pdfPage: 4 });
    expect(intent).toEqual({
      source: { folderPath: '/project/a', path: 'two.md' },
      target: {
        caseSensitive: false,
        line: 3,
        occurrenceIndex: 0,
        pdfPage: 4,
        query: 'Heading',
        wholeWord: false,
      },
      type: 'open-search-source',
    });
  });
});
