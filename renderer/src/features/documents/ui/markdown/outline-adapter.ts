import { headingSlug, type DocumentHeading } from '@/features/documents/domain/outline';

export interface ProseMirrorDocument {
  descendants(
    visit: (
      node: { attrs: { level?: number }; textContent: string; type: { name: string } },
      position: number,
    ) => void,
  ): void;
}

export interface HeadingNodeView {
  nodeDOM(position: number): Node | null;
  state: { doc: ProseMirrorDocument };
}

const headingNodes = new WeakMap<DocumentHeading, object>();

export function extractDocumentHeadings(document: ProseMirrorDocument): DocumentHeading[] {
  const headings: DocumentHeading[] = [];
  const used = new Map<string, number>();
  document.descendants((node, position) => {
    if (node.type.name !== 'heading') return;
    const text = node.textContent.trim();
    const base = headingSlug(text);
    const seen = used.get(base) ?? 0;
    used.set(base, seen + 1);
    const heading = {
      id: seen === 0 ? base : `${base}-${seen}`,
      level: Number(node.attrs.level) || 1,
      position,
      text,
    };
    headingNodes.set(heading, node);
    headings.push(heading);
  });
  return headings;
}

function sameHeading(
  current: DocumentHeading,
  selected: DocumentHeading,
  includePosition: boolean,
): boolean {
  return (
    current.id === selected.id &&
    current.level === selected.level &&
    current.text === selected.text &&
    (!includePosition || current.position === selected.position)
  );
}

export function resolveCurrentDocumentHeading(
  current: DocumentHeading[],
  selected: DocumentHeading,
): DocumentHeading | null {
  const selectedNode = headingNodes.get(selected);
  const identityMatches = selectedNode
    ? current.filter((heading) => headingNodes.get(heading) === selectedNode)
    : [];
  if (identityMatches.length === 1) return identityMatches[0];
  if (identityMatches.length > 1) {
    return (
      identityMatches.find((heading) => sameHeading(heading, selected, true)) ??
      identityMatches.find((heading) => sameHeading(heading, selected, false)) ??
      null
    );
  }
  return current.find((heading) => sameHeading(heading, selected, true)) ?? null;
}

export function headingElementAtPosition(
  view: HeadingNodeView | null,
  position: number,
): HTMLElement | null {
  const node = view?.nodeDOM(position) as HTMLElement | null | undefined;
  return node && /^H[1-6]$/u.test(node.tagName) ? node : null;
}

export function documentScroller(host: HTMLElement): HTMLElement {
  return host.querySelector<HTMLElement>('.milkdown') ?? host;
}

export function scrollOutlineToHeading(
  host: HTMLElement | null,
  selected: DocumentHeading,
  view: HeadingNodeView | null,
  reducedMotion: boolean,
): boolean {
  if (!host || !view) return false;
  const heading = resolveCurrentDocumentHeading(extractDocumentHeadings(view.state.doc), selected);
  if (!heading) return false;
  const element = headingElementAtPosition(view, heading.position);
  if (!element) return false;
  const scroller = documentScroller(host);
  const top = Math.max(
    0,
    scroller.scrollTop + element.getBoundingClientRect().top - scroller.getBoundingClientRect().top,
  );
  scroller.scrollTo({ behavior: reducedMotion ? 'auto' : 'smooth', top });
  return true;
}

export function activeHeadingId(
  entries: DocumentHeading[],
  positions: Array<{ id: string; top: number }>,
  threshold: number,
): string | null {
  let active = entries[0]?.id ?? null;
  for (const position of positions) {
    if (position.top <= threshold) active = position.id;
    else break;
  }
  return active;
}

export function applyHeadingIds(host: HTMLElement, entries: DocumentHeading[]): void {
  for (const [index, element] of Array.from(
    host.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6'),
  ).entries()) {
    const heading = entries[index];
    if (heading) element.id = heading.id;
  }
}
