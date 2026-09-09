export interface DocumentHeading {
  id: string;
  level: number;
  position: number;
  text: string;
}

export interface DocumentOutlineNode {
  children: DocumentOutlineNode[];
  heading: DocumentHeading;
}

export function headingSlug(text: string): string {
  return (
    text
      .trim()
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/gu, '')
      .replace(/[^\p{L}\p{N}_ -]/gu, '')
      .trim()
      .replace(/\s+/gu, '-') || 'section'
  );
}

export function buildDocumentOutline(headings: DocumentHeading[]): DocumentOutlineNode[] {
  const roots: DocumentOutlineNode[] = [];
  const ancestors: Array<{ level: number; node: DocumentOutlineNode }> = [];
  for (const heading of headings) {
    let top = ancestors.at(-1);
    while (top !== undefined && top.level >= heading.level) {
      ancestors.pop();
      top = ancestors.at(-1);
    }
    const node: DocumentOutlineNode = { children: [], heading };
    const parent = top?.node;
    if (parent) parent.children.push(node);
    else roots.push(node);
    ancestors.push({ level: heading.level, node });
  }
  return roots;
}
