import { describe, expect, it } from 'vite-plus/test';

import {
  dragCarriesSource,
  readSourceDrag,
  SOURCE_DRAG_MIME,
  writeSourceDrag,
} from './source-drag';

function transfer(): DataTransfer {
  const data = new Map<string, string>();
  return {
    effectAllowed: 'none',
    getData: (type: string) => data.get(type) ?? '',
    setData: (type: string, value: string) => void data.set(type, value),
    get types() {
      return Array.from(data.keys());
    },
  } as unknown as DataTransfer;
}

describe('source drag payload', () => {
  it('round-trips a source reference under its own type', () => {
    const payload = transfer();
    writeSourceDrag(payload, { folderPath: '/Library/Research', path: 'papers/report.pdf' });
    expect(dragCarriesSource(payload)).toBe(true);
    expect(readSourceDrag(payload)).toEqual({
      folderPath: '/Library/Research',
      path: 'papers/report.pdf',
    });
  });

  it('treats a foreign or malformed payload as no source', () => {
    const empty = transfer();
    expect(dragCarriesSource(empty)).toBe(false);
    expect(readSourceDrag(empty)).toBeNull();
    const malformed = transfer();
    malformed.setData(SOURCE_DRAG_MIME, '{"folderPath":1}');
    expect(readSourceDrag(malformed)).toBeNull();
    const text = transfer();
    text.setData(SOURCE_DRAG_MIME, 'not json');
    expect(readSourceDrag(text)).toBeNull();
  });
});
