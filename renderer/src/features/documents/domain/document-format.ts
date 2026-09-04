import {
  IMAGE_SOURCE_EXTENSIONS,
  MARKDOWN_NOTE_EXTENSIONS,
  PDF_EXTENSIONS,
  PLAIN_TEXT_EXTENSIONS,
  STRUCTURED_DATA_EXTENSIONS,
} from '@/shared/file-formats';

export type DocumentTextFormat = 'json' | 'md' | 'txt';

export type DocumentViewerFormat = DocumentTextFormat | 'image' | 'pdf';

function extensionOf(path: string): string | null {
  return path.split('.').at(-1)?.toLowerCase() ?? null;
}

function includesExtension(extensions: readonly string[], extension: string | null): boolean {
  return extension !== null && extensions.some((candidate) => candidate === extension);
}

export function documentTextFormat(path: string): DocumentTextFormat | null {
  const extension = extensionOf(path);
  if (includesExtension(MARKDOWN_NOTE_EXTENSIONS, extension)) return 'md';
  if (includesExtension(STRUCTURED_DATA_EXTENSIONS, extension)) return 'json';
  return includesExtension(PLAIN_TEXT_EXTENSIONS, extension) ? 'txt' : null;
}

export function documentViewerFormat(path: string): DocumentViewerFormat | null {
  const text = documentTextFormat(path);
  if (text) return text;
  const extension = extensionOf(path);
  if (includesExtension(PDF_EXTENSIONS, extension)) return 'pdf';
  return includesExtension(IMAGE_SOURCE_EXTENSIONS, extension) ? 'image' : null;
}
