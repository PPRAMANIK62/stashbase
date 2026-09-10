import { describe, expect, it } from 'vite-plus/test';

import { suggestStarters } from './starters';

describe('suggestStarters', () => {
  it('offers nothing for an empty folder', () => {
    expect(suggestStarters('Research', { files: [], folders: [] })).toEqual([]);
  });

  it('leads with the wiki and an overview, and stops at three', () => {
    const starters = suggestStarters('engineering-blogs', {
      files: ['AGENTS.md', 'CLAUDE.md', 'MISSION.md', 'NOTES.md'],
      folders: ['assets', 'learning-records', 'lessons'],
    });
    expect(starters.map((starter) => starter.label)).toEqual([
      'Build my wiki',
      "What's in engineering-blogs?",
      'Summarize learning-records/',
    ]);
    expect(starters[2]?.prompt).toBe(
      "Summarize what's in learning-records/ and what each file covers.",
    );
  });

  it('asks for a wiki in the folder’s own name, and never relabels to Update', () => {
    const [wiki] = suggestStarters('engineering-blogs', {
      files: ['MISSION.md'],
      folders: ['wiki'],
    });
    // A folder that already has pages gets the same label and the same
    // request: the first release claims no built, ready, or stale Wiki state.
    expect(wiki).toEqual({
      id: 'wiki',
      label: 'Build my wiki',
      prompt:
        "Build a wiki for engineering-blogs: create or improve the pages that map what's here.",
    });
  });

  it('gives the last slot to a file when the scope has no topic folder', () => {
    expect(
      suggestStarters('Clips', { files: ['clip.mp4', 'b.md', 'a.txt'], folders: [] }).at(-1)?.label,
    ).toBe('What does b.md say?');
    expect(
      suggestStarters('Clips', { files: ['clip.mp4', 'a.txt'], folders: [] }).at(-1)?.label,
    ).toBe('What does clip.mp4 say?');
  });

  it('skips hidden and support folders', () => {
    const starters = suggestStarters('Site', { files: [], folders: ['.obsidian', 'assets'] });
    expect(starters.map((starter) => starter.id)).toEqual(['wiki', 'overview']);
  });
});
