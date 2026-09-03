import type {
  DocumentFindController,
  FindMatchInfo,
  FindOptions,
} from '@/features/documents/application/navigation-runtime';

const ALL_HIGHLIGHT = 'stashbase-document-find';
const CURRENT_HIGHLIGHT = 'stashbase-document-find-current';
const BLOCK_SEPARATOR = '\n';
const EXCLUDED_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT']);
const BLOCK_TAGS = new Set([
  'ADDRESS',
  'ARTICLE',
  'ASIDE',
  'BLOCKQUOTE',
  'CAPTION',
  'DD',
  'DETAILS',
  'DIV',
  'DL',
  'DT',
  'FIGCAPTION',
  'FIGURE',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'HR',
  'LI',
  'MAIN',
  'OL',
  'P',
  'PRE',
  'SECTION',
  'SUMMARY',
  'TABLE',
  'TBODY',
  'TD',
  'TFOOT',
  'TH',
  'THEAD',
  'TR',
  'UL',
]);

export interface FindCorpusNode {
  data?: string;
  firstChild: FindCorpusNode | null;
  nextSibling: FindCorpusNode | null;
  nodeType: number;
  tagName?: string;
}

export function buildFindCorpus(root: FindCorpusNode): {
  joined: string;
  segments: Array<{ node: FindCorpusNode; start: number }>;
} {
  const segments: Array<{ node: FindCorpusNode; start: number }> = [];
  let joined = '';
  const separate = () => {
    if (joined && !joined.endsWith(BLOCK_SEPARATOR)) joined += BLOCK_SEPARATOR;
  };
  const visit = (node: FindCorpusNode): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      if (!node.data) return;
      segments.push({ node, start: joined.length });
      joined += node.data;
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = node.tagName ?? '';
    if (EXCLUDED_TAGS.has(tag)) return;
    if (tag === 'BR') {
      separate();
      return;
    }
    const block = BLOCK_TAGS.has(tag);
    if (block) separate();
    for (let child = node.firstChild; child; child = child.nextSibling) visit(child);
    if (block) separate();
  };
  visit(root);
  return { joined, segments };
}

function findExpression(query: string, options: FindOptions): RegExp | null {
  if (!query) return null;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const source = options.wholeWord ? `(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])` : escaped;
  try {
    return new RegExp(source, options.caseSensitive ? 'gu' : 'giu');
  } catch {
    return null;
  }
}

function collectMatches(document: Document, root: HTMLElement, expression: RegExp): Range[] {
  const corpus = buildFindCorpus(root as unknown as FindCorpusNode);
  const textSegments = corpus.segments as unknown as Array<{ node: Text; start: number }>;
  const matches: Range[] = [];
  let segmentIndex = 0;
  const segmentAt = (offset: number) => {
    while (
      segmentIndex + 1 < textSegments.length &&
      textSegments[segmentIndex + 1].start <= offset
    ) {
      segmentIndex += 1;
    }
    return textSegments[segmentIndex];
  };

  for (const match of corpus.joined.matchAll(expression)) {
    if (match.index === undefined || !match[0]) continue;
    const start = segmentAt(match.index);
    const end = segmentAt(match.index + match[0].length - 1);
    if (!start || !end) continue;
    const range = document.createRange();
    try {
      range.setStart(start.node, match.index - start.start);
      range.setEnd(end.node, match.index + match[0].length - end.start);
      matches.push(range);
    } catch {
      // A concurrent editor transaction replaced a text node. The observer reruns Find.
    }
  }
  return matches;
}

interface HighlightRegistry {
  delete(name: string): void;
  set(name: string, value: unknown): void;
}

function paint(window: Window, matches: Range[], current: Range | null): void {
  const environment = window as unknown as {
    CSS?: { highlights?: HighlightRegistry };
    Highlight?: new (...ranges: Range[]) => unknown;
  };
  if (!environment.CSS?.highlights || !environment.Highlight) return;
  if (matches.length === 0) {
    environment.CSS.highlights.delete(ALL_HIGHLIGHT);
    environment.CSS.highlights.delete(CURRENT_HIGHLIGHT);
    return;
  }
  const remaining = current ? matches.filter((match) => match !== current) : matches;
  environment.CSS.highlights.set(ALL_HIGHLIGHT, new environment.Highlight(...remaining));
  if (current) {
    environment.CSS.highlights.set(CURRENT_HIGHLIGHT, new environment.Highlight(current));
  } else {
    environment.CSS.highlights.delete(CURRENT_HIGHLIGHT);
  }
}

function scrollRangeIntoView(range: Range, scroller: HTMLElement): void {
  const rect = Array.from(range.getClientRects()).find(
    (candidate) => candidate.width > 0 && candidate.height > 0,
  );
  if (!rect) return;
  const container = scroller.getBoundingClientRect();
  scroller.scrollBy({
    behavior: 'auto',
    left: rect.left - container.left + rect.width / 2 - scroller.clientWidth / 2,
    top: rect.top - container.top + rect.height / 2 - scroller.clientHeight / 2,
  });
}

export interface DisposableDocumentFindController extends DocumentFindController {
  dispose(): void;
}

export function createMarkdownFindController(
  root: HTMLElement,
  scroller: HTMLElement,
): DisposableDocumentFindController {
  const document = root.ownerDocument;
  const window = document.defaultView;
  let matches: Range[] = [];
  let cursor = -1;
  let query = '';
  let options: FindOptions = { caseSensitive: false, wholeWord: false };
  let disposed = false;
  let refreshQueued = false;

  const report = (): FindMatchInfo => ({
    current: cursor < 0 ? 0 : cursor + 1,
    total: matches.length,
  });
  const recompute = (preserveSelection: boolean, scroll: boolean): FindMatchInfo => {
    const priorCursor = cursor;
    const expression = findExpression(query, options);
    matches = expression ? collectMatches(document, root, expression) : [];
    cursor =
      matches.length === 0 ? -1 : preserveSelection ? Math.min(priorCursor, matches.length - 1) : 0;
    if (window) paint(window, matches, matches[cursor] ?? null);
    if (scroll && cursor >= 0) scrollRangeIntoView(matches[cursor], scroller);
    return report();
  };
  const observer = new MutationObserver(() => {
    if (disposed || !query || refreshQueued) return;
    refreshQueued = true;
    queueMicrotask(() => {
      refreshQueued = false;
      if (!disposed && query) recompute(true, false);
    });
  });
  observer.observe(root, { characterData: true, childList: true, subtree: true });

  const step = (offset: 1 | -1): FindMatchInfo => {
    if (matches.length === 0) return report();
    cursor = (cursor + offset + matches.length) % matches.length;
    if (window) paint(window, matches, matches[cursor]);
    scrollRangeIntoView(matches[cursor], scroller);
    return report();
  };

  return {
    close() {
      matches = [];
      cursor = -1;
      query = '';
      if (window) paint(window, [], null);
    },
    dispose() {
      disposed = true;
      observer.disconnect();
      this.close();
    },
    next: () => step(1),
    previous: () => step(-1),
    restoreQuery(nextQuery, nextOptions) {
      query = nextQuery;
      options = nextOptions;
      return recompute(true, false);
    },
    setQuery(nextQuery, nextOptions) {
      query = nextQuery;
      options = nextOptions;
      return recompute(false, true);
    },
  };
}
