export type DocumentHeading = { id: string; level: number; text: string };
export type OutlineMode = 'docked' | 'overlay';

type ProseMirrorDocument = { descendants: (visit: (node: { type: { name: string }; attrs: { level?: number }; textContent: string }) => void) => void };

export function headingSlug(text: string): string {
  return text.trim().toLowerCase().normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}_ -]/gu, '')
    .trim().replace(/\s+/g, '-') || 'section';
}

export function extractDocumentHeadings(doc: ProseMirrorDocument): DocumentHeading[] {
  const headings: DocumentHeading[] = [];
  const used = new Map<string, number>();
  doc.descendants((node) => {
    if (node.type.name !== 'heading') return;
    const text = node.textContent.trim();
    const base = headingSlug(text);
    const seen = used.get(base) ?? 0;
    used.set(base, seen + 1);
    headings.push({ id: seen === 0 ? base : `${base}-${seen}`, level: Number(node.attrs.level) || 1, text });
  });
  return headings;
}

export const outlineModeForWidth = (mainPaneWidth: number): OutlineMode => mainPaneWidth >= 1080 ? 'docked' : 'overlay';

export function activeHeadingId(entries: DocumentHeading[], positions: Array<{ id: string; top: number }>, threshold: number): string | null {
  let active = entries[0]?.id ?? null;
  for (const position of positions) {
    if (position.top <= threshold) active = position.id;
    else break;
  }
  return active;
}
