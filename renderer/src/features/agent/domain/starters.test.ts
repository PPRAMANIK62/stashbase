import { describe, expect, it } from 'vite-plus/test';

import { suggestStarters } from './starters';

describe('suggestStarters', () => {
  it('offers nothing for an empty folder', () => {
    expect(suggestStarters('Research', { files: [], folders: [] })).toEqual([]);
  });

  it('leads with an overview, then a topic folder, then an anchor file', () => {
    const starters = suggestStarters('engineering-blogs', {
      files: ['AGENTS.md', 'CLAUDE.md', 'MISSION.md', 'NOTES.md'],
      folders: ['assets', 'learning-records', 'lessons'],
    });
    expect(starters.map((starter) => starter.label)).toEqual([
      "What's in engineering-blogs?",
      'Summarize learning-records/',
      'What does MISSION.md say?',
    ]);
    expect(starters[1]?.prompt).toBe(
      "Summarize what's in learning-records/ and what each file covers.",
    );
  });

  it('falls back to the first markdown file, then any file, when no anchor exists', () => {
    expect(
      suggestStarters('Clips', { files: ['clip.mp4', 'b.md', 'a.txt'], folders: [] }).at(-1)?.label,
    ).toBe('What does b.md say?');
    expect(
      suggestStarters('Clips', { files: ['clip.mp4', 'a.txt'], folders: [] }).at(-1)?.label,
    ).toBe('What does clip.mp4 say?');
  });

  it('skips hidden and support folders', () => {
    const starters = suggestStarters('Site', { files: [], folders: ['.obsidian', 'assets'] });
    expect(starters.map((starter) => starter.id)).toEqual(['overview']);
  });
});
