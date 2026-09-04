import { describe, expect, it } from 'vite-plus/test';

import {
  quickOpenNavigationIntent,
  rankQuickOpenSources,
  type QuickOpenSource,
} from './quick-open';

const sources: QuickOpenSource[] = [
  {
    action: 'open',
    retrievalAccess: 'included',
    source: { folderPath: '/library/notes', path: 'projects/other.md' },
  },
  {
    action: 'open',
    retrievalAccess: 'included',
    source: { folderPath: '/library/notes', path: 'archive/project-notes.md' },
  },
  {
    action: 'open',
    retrievalAccess: 'excluded',
    source: { folderPath: '/library/notes', path: 'one/report.bin' },
  },
  {
    action: 'reveal',
    retrievalAccess: 'excluded',
    source: { folderPath: '/library/notes', path: 'two/report.bin' },
  },
];

describe('Quick Open ranking', () => {
  it('shows every scoped source in stable basename and path order without a query', () => {
    expect(rankQuickOpenSources(sources, '').map((item) => item.source.path)).toEqual([
      'projects/other.md',
      'archive/project-notes.md',
      'one/report.bin',
      'two/report.bin',
    ]);
  });

  it('ranks basename matches before relative-path-only matches', () => {
    expect(rankQuickOpenSources(sources, 'pro').map((item) => item.source.path)).toEqual([
      'archive/project-notes.md',
      'projects/other.md',
    ]);
  });

  it('keeps duplicate basenames distinguishable through their parent paths', () => {
    expect(
      rankQuickOpenSources(sources, 'report').map(({ basename, parentPath }) => ({
        basename,
        parentPath,
      })),
    ).toEqual([
      { basename: 'report.bin', parentPath: 'one' },
      { basename: 'report.bin', parentPath: 'two' },
    ]);
  });

  it('emits an explicit app-resolved intent for open and reveal actions', () => {
    const items = rankQuickOpenSources(sources, 'report');

    expect(quickOpenNavigationIntent(items[0]!)).toEqual({
      type: 'open-source',
      source: { folderPath: '/library/notes', path: 'one/report.bin' },
    });
    expect(quickOpenNavigationIntent(items[1]!)).toEqual({
      type: 'reveal-source',
      source: { folderPath: '/library/notes', path: 'two/report.bin' },
    });
  });
});
