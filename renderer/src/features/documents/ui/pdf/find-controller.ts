import type { PDFDocumentProxy } from 'pdfjs-dist';

import type {
  DocumentFindController,
  FindMatchInfo,
  FindOptions,
} from '@/features/documents/application/navigation-runtime';

export interface PdfFindMatch {
  page: number;
  yRatio: number;
}

export function foldPdfText(value: string): string {
  return value
    .replace(/[‐-―−]/gu, '-')
    .replace(/[‘’]/gu, "'")
    .replace(/[“”]/gu, '"')
    .replace(/[\u00a0\u200b]/gu, ' ');
}

function isBoundary(text: string, index: number): boolean {
  const character = text[index];
  return character === undefined || !/[\p{L}\p{N}_]/u.test(character);
}

export function textOffsets(text: string, query: string, options: FindOptions): number[] {
  const foldedText = foldPdfText(text);
  const foldedQuery = foldPdfText(query).trim();
  if (!foldedQuery) return [];
  const haystack = options.caseSensitive ? foldedText : foldedText.toLowerCase();
  const needle = options.caseSensitive ? foldedQuery : foldedQuery.toLowerCase();
  const matches: number[] = [];
  for (
    let offset = haystack.indexOf(needle);
    offset >= 0;
    offset = haystack.indexOf(needle, offset + Math.max(1, needle.length))
  ) {
    if (
      !options.wholeWord ||
      (isBoundary(foldedText, offset - 1) && isBoundary(foldedText, offset + needle.length))
    ) {
      matches.push(offset);
    }
  }
  return matches;
}

async function scanDocument(
  document: PDFDocumentProxy,
  query: string,
  options: FindOptions,
  cancelled: () => boolean,
): Promise<PdfFindMatch[]> {
  const matches: PdfFindMatch[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    if (cancelled()) return [];
    let page: Awaited<ReturnType<PDFDocumentProxy['getPage']>> | null = null;
    try {
      page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const items = content.items.filter(
        (item): item is Extract<(typeof content.items)[number], { str: string }> => 'str' in item,
      );
      const starts: Array<{ offset: number; y: number }> = [];
      let text = '';
      for (const item of items) {
        if (text && !/\s$/u.test(text) && !/^\s/u.test(item.str)) text += ' ';
        starts.push({ offset: text.length, y: Number(item.transform[5] ?? 0) });
        text += item.str.replace(/\s+/gu, ' ');
      }
      const viewport = page.getViewport({ scale: 1 });
      for (const offset of textOffsets(text, query, options)) {
        let item: (typeof starts)[number] | undefined;
        for (const candidate of starts) {
          if (candidate.offset > offset) break;
          item = candidate;
        }
        const yRatio = item ? Math.max(0, Math.min(1, 1 - item.y / viewport.height)) : 0;
        matches.push({ page: pageNumber, yRatio });
      }
    } catch {
      // A damaged page does not make the rest of the document unsearchable.
    } finally {
      page?.cleanup();
    }
  }
  return matches;
}

export function createPdfFindController(
  document: PDFDocumentProxy,
  onMatch: (match: PdfFindMatch) => void,
): DocumentFindController & { dispose(): void } {
  let disposed = false;
  let generation = 0;
  let matches: PdfFindMatch[] = [];
  let current = -1;
  const report = (): FindMatchInfo => ({
    current: current < 0 ? 0 : current + 1,
    total: matches.length,
  });
  const rebuild = async (query: string, options: FindOptions, select: boolean) => {
    const request = ++generation;
    const found = await scanDocument(
      document,
      query,
      options,
      () => disposed || request !== generation,
    );
    if (disposed || request !== generation) return { current: 0, total: 0 };
    matches = found;
    current = matches.length > 0 ? 0 : -1;
    const first = matches[current];
    if (select && first) onMatch(first);
    return report();
  };
  const step = (direction: 1 | -1) => {
    if (matches.length === 0) return report();
    current = (current + direction + matches.length) % matches.length;
    const active = matches[current];
    if (active) onMatch(active);
    return report();
  };
  return {
    close() {
      generation += 1;
      matches = [];
      current = -1;
    },
    dispose() {
      disposed = true;
      generation += 1;
      matches = [];
    },
    next: () => step(1),
    previous: () => step(-1),
    restoreQuery: (query, options) => rebuild(query, options, false),
    setQuery: (query, options) => rebuild(query, options, true),
  };
}
