/**
 * Where a reader is taken inside a document: the anchor a link named, or the
 * search occurrence a result pointed at. The location is a value the history
 * keeps beside a source, so it lives here rather than with the Find runtime
 * that eventually delivers it.
 */

export interface FindOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
}

export interface DocumentSearchTarget extends FindOptions {
  line?: number;
  occurrenceIndex: number;
  pdfPage?: number;
  query: string;
}

/** The place inside a document an open lands on. Both absent means the top. */
export interface DocumentLocation {
  scroll?: { top: number; left: number };
  anchor?: string;
  search?: DocumentSearchTarget;
}
