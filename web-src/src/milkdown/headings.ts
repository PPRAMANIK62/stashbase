export type DocumentHeading = { id: string; level: number; text: string; position: number };

export type ProseMirrorDocument = { descendants: (visit: (node: { type: { name: string }; attrs: { level?: number }; textContent: string }, position: number) => void) => void };
const headingNodes = new WeakMap<DocumentHeading, object>();

export function headingSlug(text: string): string {
  return text.trim().toLowerCase().normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}_ -]/gu, '')
    .trim().replace(/\s+/g, '-') || 'section';
}

export function extractDocumentHeadings(doc: ProseMirrorDocument): DocumentHeading[] {
  const headings: DocumentHeading[] = [];
  const used = new Map<string, number>();
  doc.descendants((node, position) => {
    if (node.type.name !== 'heading') return;
    const text = node.textContent.trim();
    const base = headingSlug(text);
    const seen = used.get(base) ?? 0;
    used.set(base, seen + 1);
    const heading = { id: seen === 0 ? base : `${base}-${seen}`, level: Number(node.attrs.level) || 1, text, position };
    headingNodes.set(heading, node);
    headings.push(heading);
  });
  return headings;
}

/** Maps an outline entry retained across a React render to its latest
 * ProseMirror position. Unchanged nodes keep identity across transactions. */
export function resolveCurrentDocumentHeading(current: DocumentHeading[], selected: DocumentHeading): DocumentHeading | null {
  const selectedNode = headingNodes.get(selected);
  const identityMatch = selectedNode
    ? current.find((heading) => headingNodes.get(heading) === selectedNode)
    : undefined;
  if (identityMatch) return identityMatch;
  return current.find((heading) =>
    heading.id === selected.id
    && heading.level === selected.level
    && heading.text === selected.text
    && heading.position === selected.position,
  ) ?? null;
}

/** A heading owns every following, deeper heading until the next peer or
 * ancestor. This is the same structural rule used by editor outline trees. */
export function outlineHasChildren(headings: DocumentHeading[], index: number): boolean {
  return index < headings.length - 1 && headings[index + 1].level > headings[index].level;
}

/** Maps headings to their structural outline depth. Markdown permits skipped
 * heading levels, but the sidebar should indent only one tree step per actual
 * parent/child relationship, just like the file browser. */
export function outlineDepth(headings: DocumentHeading[], index: number): number {
  return outlineDepths(headings)[index] ?? 0;
}

/** Compute every tree depth together so large documents stay linear. */
export function outlineDepths(headings: DocumentHeading[]): number[] {
  const ancestors: number[] = [];
  return headings.map((heading) => {
    const level = heading.level;
    while (ancestors.length && ancestors[ancestors.length - 1] >= level) ancestors.pop();
    const depth = ancestors.length;
    ancestors.push(level);
    return depth;
  });
}

/** Removes descendants of collapsed outline entries without changing the
 * retained Markdown document or its heading order. */
export function visibleOutlineHeadings(headings: DocumentHeading[], collapsed: ReadonlySet<string>): DocumentHeading[] {
  const collapsedAncestors: number[] = [];
  return headings.filter((heading) => {
    while (collapsedAncestors.length && collapsedAncestors[collapsedAncestors.length - 1] >= heading.level) {
      collapsedAncestors.pop();
    }
    const visible = collapsedAncestors.length === 0;
    if (collapsed.has(heading.id)) collapsedAncestors.push(heading.level);
    return visible;
  });
}

/** Compute the document-scroller offset for an outline selection. */
export function outlineScrollTop(scrollerTop: number, scrollTop: number, headingTop: number): number {
  return Math.max(0, scrollTop + headingTop - scrollerTop);
}

export function activeHeadingId(entries: DocumentHeading[], positions: Array<{ id: string; top: number }>, threshold: number): string | null {
  let active = entries[0]?.id ?? null;
  for (const position of positions) {
    if (position.top <= threshold) active = position.id;
    else break;
  }
  return active;
}
