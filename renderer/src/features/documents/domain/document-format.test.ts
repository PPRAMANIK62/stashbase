import { describe, expect, it } from 'vite-plus/test';

import {
  AUDIO_ONLY_SOURCE_EXTENSIONS,
  DOCX_EXTENSIONS,
  HTML_NOTE_EXTENSIONS,
  IMAGE_SOURCE_EXTENSIONS,
  PDF_EXTENSIONS,
  VIDEO_SOURCE_EXTENSIONS,
} from '@/contracts/file-formats';

import { documentTextFormat, documentViewerFormat } from './document-format';

describe('document format', () => {
  it('classifies Markdown, JSON, and TXT source names for direct loading', () => {
    expect(documentTextFormat('notes/plan.md')).toBe('md');
    expect(documentTextFormat('notes/plan.MARKDOWN')).toBe('md');
    expect(documentTextFormat('notes/literal.TXT')).toBe('txt');
    expect(documentTextFormat('notes/data.json')).toBe('json');
    expect(documentTextFormat('notes/no-extension')).toBeNull();
    expect(documentViewerFormat('notes/no-extension')).toBe('generic');
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
    expect(documentViewerFormat('images/animation.gif')).toBe('generic');
  });

  it('routes HTML and DOCX to preview-only viewers', () => {
    for (const extension of HTML_NOTE_EXTENSIONS) {
      expect(documentViewerFormat(`pages/archive.${extension.toUpperCase()}`)).toBe('html');
      expect(documentTextFormat(`pages/archive.${extension}`)).toBeNull();
    }
    for (const extension of DOCX_EXTENSIONS) {
      expect(documentViewerFormat(`documents/report.${extension.toUpperCase()}`)).toBe('docx');
      expect(documentTextFormat(`documents/report.${extension}`)).toBeNull();
    }
  });

  it('routes every canonical audio and video extension to media viewing', () => {
    for (const extension of [...AUDIO_ONLY_SOURCE_EXTENSIONS, ...VIDEO_SOURCE_EXTENSIONS]) {
      expect(documentViewerFormat(`recordings/source.${extension.toUpperCase()}`)).toBe('audio');
      expect(documentTextFormat(`recordings/source.${extension}`)).toBeNull();
    }
  });
});
