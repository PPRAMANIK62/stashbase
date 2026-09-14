import { describe, expect, it } from 'vite-plus/test';

import { formatBytes } from './format-bytes';

describe('formatBytes', () => {
  it('names small sizes in bytes rather than rounding them up to a kilobyte', () => {
    expect(formatBytes(10)).toBe('10 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1023)).toBe('1023 B');
  });

  it('keeps one decimal below ten and drops it above', () => {
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(180 * 1024)).toBe('180 KB');
    expect(formatBytes(1.5 * 1024 ** 2)).toBe('1.5 MB');
    expect(formatBytes(150 * 1024 ** 2)).toBe('150 MB');
  });

  it('climbs to gigabytes for a model-sized download', () => {
    expect(formatBytes(2 * 1024 ** 3)).toBe('2.0 GB');
    expect(formatBytes(1.5 * 1024 ** 3)).toBe('1.5 GB');
  });

  it('answers nothing for nothing, and for a number that is not a size', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(-1)).toBe('0 B');
    expect(formatBytes(Number.NaN)).toBe('0 B');
  });
});
