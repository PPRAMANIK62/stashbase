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
  return <nav id="document-outline" className="document-outline" aria-label="Document outline">
    <div ref={listRef} className="document-outline-list">
      {headings.length === 0 ? <p className="document-outline-empty">No headings</p> : visibleHeadings.map((heading) => {
        const label = heading.text || `Untitled section ${++emptyCount}`;
        const index = headingIndexes.get(heading.id) ?? 0;
        const depth = depths[index] ?? 0;
        const hasChildren = outlineHasChildren(headings, index);
        const isCollapsed = collapsed.has(heading.id);
        return <div key={heading.id} className={'tree-row outline-tree-row' + (activeId === heading.id ? ' active' : '') + (isCollapsed ? ' collapsed' : '')} style={{ paddingLeft: Math.min(depth, 4) * 14 + 4 } as React.CSSProperties}>
          {hasChildren ? <button type="button" className="chev document-outline-disclosure" aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${label}`} aria-expanded={!isCollapsed} onClick={() => setCollapsed((previous) => {
            const next = new Set(previous);
            if (isCollapsed) next.delete(heading.id);
            else next.add(heading.id);
            return next;
          })}><ChevronDownIcon /></button> : <span className="document-outline-disclosure-spacer" aria-hidden="true" />}
          <button type="button" className="outline-tree-entry" title={label} aria-label={`Heading level ${heading.level}: ${label}`} aria-current={activeId === heading.id ? 'location' : undefined} onClick={() => onSelect(heading)}><span className="label">{label}</span></button>
        </div>;
      })}
    </div>
  </nav>;
}
