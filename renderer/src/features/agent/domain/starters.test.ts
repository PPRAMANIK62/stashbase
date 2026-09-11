import { describe, expect, it } from 'vite-plus/test';

import { emptyChatPrompts } from './starters';

describe('emptyChatPrompts', () => {
  it('offers nothing for an empty folder', () => {
    expect(emptyChatPrompts('Research', { files: [], folders: [] })).toEqual([]);
  });

  it('cycles one request per thing the space does, each naming the folder', () => {
    expect(
      emptyChatPrompts('engineering-blogs', { files: ['MISSION.md'], folders: ['lessons'] }),
    ).toEqual([
      'Build a wiki for engineering-blogs',
      "What's in engineering-blogs?",
      'Write a blog post about engineering-blogs',
    ]);
  });

  it('asks for a wiki in the same words for a folder that already has one', () => {
    // No built, ready, or stale state is claimed, so the request never
    // becomes "update".
    expect(emptyChatPrompts('Site', { files: [], folders: ['wiki'] })[0]).toBe(
      'Build a wiki for Site',
    );
  });
});
