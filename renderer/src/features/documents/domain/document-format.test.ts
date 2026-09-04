import { describe, expect, it } from 'vite-plus/test';

import { IMAGE_SOURCE_EXTENSIONS, PDF_EXTENSIONS } from '@/shared/file-formats';

import { documentTextFormat, documentViewerFormat } from './document-format';

describe('document format', () => {
  it('classifies Markdown, JSON, and TXT source names for direct loading', () => {
    expect(documentTextFormat('notes/plan.md')).toBe('md');
    expect(documentTextFormat('notes/plan.MARKDOWN')).toBe('md');
    expect(documentTextFormat('notes/literal.TXT')).toBe('txt');
    expect(documentTextFormat('notes/data.json')).toBe('json');
    expect(documentTextFormat('notes/no-extension')).toBeNull();
  });

  it('routes every canonical PDF and image extension without making it editable text', () => {
    for (const extension of PDF_EXTENSIONS) {
      expect(documentViewerFormat(`papers/report.${extension.toUpperCase()}`)).toBe('pdf');
      expect(documentTextFormat(`papers/report.${extension}`)).toBeNull();
    }
    for (const extension of IMAGE_SOURCE_EXTENSIONS) {
      expect(documentViewerFormat(`images/source.${extension.toUpperCase()}`)).toBe('image');
      expect(documentTextFormat(`images/source.${extension}`)).toBeNull();
    }
    expect(documentViewerFormat('images/animation.gif')).toBeNull();
  });
});
