import { describe, expect, it, vi } from 'vite-plus/test';

import { createMediaFindController } from './find-controller';

const segments = [
  { endMs: 2_000, id: 0, startMs: 0, text: 'Design systems make design coherent.' },
  { endMs: 4_000, id: 1, startMs: 2_000, text: 'System behavior stays visible.' },
];

describe('media transcript Find', () => {
  it('counts occurrences and cycles through their timestamped segments', () => {
    const select = vi.fn();
    const controller = createMediaFindController(segments, select);

    expect(controller.setQuery('design', { caseSensitive: false, wholeWord: true })).toEqual({
      current: 1,
      total: 2,
    });
    expect(select).toHaveBeenLastCalledWith(segments[0]);
    expect(controller.next()).toEqual({ current: 2, total: 2 });
    expect(controller.next()).toEqual({ current: 1, total: 2 });
    expect(controller.previous()).toEqual({ current: 2, total: 2 });
  });

  it('honors case and whole-word options and clears selection on close', () => {
    const select = vi.fn();
    const controller = createMediaFindController(segments, select);

    expect(controller.setQuery('System', { caseSensitive: true, wholeWord: true })).toEqual({
      current: 1,
      total: 1,
    });
    expect(controller.setQuery('sign', { caseSensitive: false, wholeWord: true })).toEqual({
      current: 0,
      total: 0,
    });
    controller.close();
    expect(select).toHaveBeenLastCalledWith(null);
  });
});
