import { describe, expect, it } from 'vite-plus/test';

import { buildDocumentOutline, headingSlug, type DocumentHeading } from './outline';

const headings: DocumentHeading[] = [
  { id: 'one', level: 1, position: 0, text: 'One' },
  { id: 'two', level: 3, position: 1, text: 'Two' },
  { id: 'three', level: 4, position: 2, text: 'Three' },
  { id: 'four', level: 2, position: 3, text: 'Four' },
];

describe('document outline model', () => {
  it('allocates portable Unicode heading slugs', () => {
    expect(headingSlug(' Résumé! ')).toBe('resume');
    expect(headingSlug('日本語!')).toBe('日本語');
    expect(headingSlug('***')).toBe('section');
  });

  it('derives hierarchy from structure even when heading levels skip', () => {
    expect(buildDocumentOutline(headings)).toEqual([
      {
        children: [
          {
            children: [{ children: [], heading: headings[2] }],
            heading: headings[1],
          },
          { children: [], heading: headings[3] },
        ],
        heading: headings[0],
      },
    ]);
  });
});
