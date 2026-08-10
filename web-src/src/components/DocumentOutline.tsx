import * as React from 'react';
import { ChevronDownIcon } from '../icons';
import { outlineDepths, outlineHasChildren, visibleOutlineHeadings, type DocumentHeading } from '../milkdown/headings';

export function DocumentOutline({
  headings,
  activeId,
  onSelect,
}: {
  headings: DocumentHeading[];
  activeId: string | null;
  onSelect: (heading: DocumentHeading) => void;
}) {
  const listRef = React.useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = React.useState<Set<string>>(() => new Set());

  React.useEffect(() => {
    listRef.current?.querySelector<HTMLButtonElement>('[aria-current="location"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeId]);

  React.useEffect(() => {
    const ids = new Set(headings.map((heading) => heading.id));
    setCollapsed((previous) => {
      const next = new Set([...previous].filter((id) => ids.has(id)));
      return next.size === previous.size ? previous : next;
    });
  }, [headings]);

  let emptyCount = 0;
  const visibleHeadings = visibleOutlineHeadings(headings, collapsed);
  const depths = React.useMemo(() => outlineDepths(headings), [headings]);
  const headingIndexes = React.useMemo(
    () => new Map(headings.map((heading, index) => [heading.id, index])),
    [headings],
  );
  /* Rows reuse the exempted `.tree-row` family (`chev`, `label`, `active`,
   * `collapsed`) so the outline stays visually locked to the file tree;
   * only the outline-specific layout is expressed as utilities here. */
  return <nav id="document-outline" className="flex min-h-0 flex-1 overflow-hidden" aria-label="Document outline">
    <div ref={listRef} className="scrollbar-quiet flex-1 overflow-auto px-1.5 pb-2">
      {headings.length === 0 ? <p className="mx-3 my-2 text-sm text-muted-foreground">No headings</p> : visibleHeadings.map((heading) => {
        const label = heading.text || `Untitled section ${++emptyCount}`;
        const index = headingIndexes.get(heading.id) ?? 0;
        const depth = depths[index] ?? 0;
        const hasChildren = outlineHasChildren(headings, index);
        const isCollapsed = collapsed.has(heading.id);
        return <div key={heading.id} className={'tree-row' + (activeId === heading.id ? ' active' : '') + (isCollapsed ? ' collapsed' : '')} style={{ paddingLeft: Math.min(depth, 4) * 14 + 4 } as React.CSSProperties}>
          {hasChildren ? <button type="button" className="chev cursor-pointer border-0 bg-transparent p-0" aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${label}`} aria-expanded={!isCollapsed} onClick={() => setCollapsed((previous) => {
            const next = new Set(previous);
            if (isCollapsed) next.delete(heading.id);
            else next.add(heading.id);
            return next;
          })}><ChevronDownIcon /></button> : <span className="size-4 flex-none" aria-hidden="true" />}
          <button type="button" className="flex min-w-0 flex-1 cursor-pointer items-center border-0 bg-transparent p-0 text-left [font:inherit] text-inherit focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" title={label} aria-label={`Heading level ${heading.level}: ${label}`} aria-current={activeId === heading.id ? 'location' : undefined} onClick={() => onSelect(heading)}><span className="label">{label}</span></button>
        </div>;
      })}
    </div>
  </nav>;
}
