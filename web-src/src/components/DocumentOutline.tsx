import * as React from 'react';
import type { DocumentHeading, OutlineMode } from '../milkdown/headings';

export function DocumentOutline({
  headings,
  activeId,
  mode,
  onClose,
  onSelect,
}: {
  headings: DocumentHeading[];
  activeId: string | null;
  mode: OutlineMode;
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  let emptyCount = 0;
  return <nav id="document-outline" className={`document-outline ${mode}`} aria-label="Document outline">
    <div className="document-outline-head">
      <div><span className="document-outline-title">Outline</span><span className="document-outline-count">{headings.length} {headings.length === 1 ? 'heading' : 'headings'}</span></div>
      <button type="button" className="document-outline-close" aria-label="Close outline" title="Close outline" onClick={onClose}>×</button>
    </div>
    <div className="document-outline-list">
      {headings.length === 0 ? <p className="document-outline-empty">No headings</p> : headings.map((heading) => {
        const label = heading.text || `Untitled section ${++emptyCount}`;
        return <button key={heading.id} type="button" className="document-outline-entry" style={{ paddingLeft: `${8 + (heading.level - 1) * 12}px` }} title={label} aria-label={`Heading level ${heading.level}: ${label}`} aria-current={activeId === heading.id ? 'location' : undefined} onClick={() => onSelect(heading.id)}><span className="document-outline-level">H{heading.level}</span><span className="document-outline-label">{label}</span></button>;
      })}
    </div>
  </nav>;
}
