import { describe, expect, it } from 'vite-plus/test';

import {
  dragCarriesSource,
  readSourceDrag,
  SOURCE_DRAG_MIME,
  writeSourceDrag,
} from './source-drag';

describe('source drag payload', () => {
  it('round-trips a source reference under its own type', () => {
    const payload = new DataTransfer();
    writeSourceDrag(payload, { folderPath: '/Library/Research', path: 'papers/report.pdf' });
    expect(dragCarriesSource(payload)).toBe(true);
    expect(payload.effectAllowed).toBe('copy');
    expect(readSourceDrag(payload)).toEqual({
      folderPath: '/Library/Research',
      path: 'papers/report.pdf',
    });
  });

  it('treats a foreign or malformed payload as no source', () => {
    const empty = new DataTransfer();
    expect(dragCarriesSource(empty)).toBe(false);
    expect(readSourceDrag(empty)).toBeNull();
    const malformed = new DataTransfer();
    malformed.setData(SOURCE_DRAG_MIME, '{"folderPath":1}');
    expect(readSourceDrag(malformed)).toBeNull();
    const text = new DataTransfer();
    text.setData(SOURCE_DRAG_MIME, 'not json');
    expect(readSourceDrag(text)).toBeNull();
  });
});
