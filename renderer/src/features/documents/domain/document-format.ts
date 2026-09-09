import {
  AUDIO_SOURCE_EXTENSIONS,
  DOCX_EXTENSIONS,
  HTML_NOTE_EXTENSIONS,
  IMAGE_SOURCE_EXTENSIONS,
  MARKDOWN_NOTE_EXTENSIONS,
  PDF_EXTENSIONS,
  PLAIN_TEXT_EXTENSIONS,
  STRUCTURED_DATA_EXTENSIONS,
  type ViewerFormat,
} from '@/contracts/file-formats';

/** The formats whose source file is itself the editable text. */
export type DocumentTextFormat = Extract<ViewerFormat, 'json' | 'md' | 'txt'>;

/** The renderer speaks the same format vocabulary as the server file listing;
 *  a name nothing claims opens as `generic`. */
export type DocumentViewerFormat = ViewerFormat;

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

export function documentViewerFormat(path: string): DocumentViewerFormat {
  const text = documentTextFormat(path);
  if (text) return text;
  const extension = extensionOf(path);
  if (includesExtension(HTML_NOTE_EXTENSIONS, extension)) return 'html';
  if (includesExtension(DOCX_EXTENSIONS, extension)) return 'docx';
  if (includesExtension(PDF_EXTENSIONS, extension)) return 'pdf';
  if (includesExtension(AUDIO_SOURCE_EXTENSIONS, extension)) return 'audio';
  return includesExtension(IMAGE_SOURCE_EXTENSIONS, extension) ? 'image' : 'generic';
}
