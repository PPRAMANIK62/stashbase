import { describe, expect, it } from 'vite-plus/test';

import { clamp } from './clamp';

describe('clamp', () => {
  it('leaves a value already inside the range', () => {
    expect(clamp(320, 240, 640)).toBe(320);
  });

  it('confines a value to each bound', () => {
    expect(clamp(120, 240, 640)).toBe(240);
    expect(clamp(900, 240, 640)).toBe(640);
    expect(clamp(240, 240, 640)).toBe(240);
    expect(clamp(640, 240, 640)).toBe(640);
  });

  it('lets the floor win an inverted range', () => {
    expect(clamp(500, 640, 240)).toBe(640);
  });
});
