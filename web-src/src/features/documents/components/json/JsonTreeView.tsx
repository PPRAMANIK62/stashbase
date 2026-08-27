import React, { useEffect, useMemo, useRef, useState } from 'react';
import './json-tree.css';
import { Button } from '@/common/components/ui/button';
import { Field, FieldLabel } from '@/common/components/ui/field';
import { Input } from '@/common/components/ui/input';
import { SectionHeading } from '@/common/components/ui/section';
import { Textarea } from '@/common/components/ui/textarea';
import {
  addJsonChild, analyzeJsonSource, deleteJsonPath, formatPath, renameJsonProperty,
  matchingJsonTreeNodes, reorderJsonArrayItem, replaceJsonNode, type JsonSourceNode,
} from '@/features/documents/lib/json/sourceModel';
import { cn } from '@/common/lib/utils';

/* The editor panel's label look, which used to live as a `.json-tree-editor
 * label` element selector in the colocated stylesheet — a rule that stopped
 * describing the markup the moment the wrapping labels became `Field` +
 * `FieldLabel` pairs. Held here so the class does the styling and the CSS
 * file keeps the panel's own layout. */
const JSON_FIELD_LABEL_CLASS = 'text-sm font-normal text-muted-foreground';

type EditIntent =
  | { kind: 'value' | 'subtree'; node: JsonSourceNode }
  | { kind: 'rename'; node: JsonSourceNode }
  | { kind: 'add'; node: JsonSourceNode };

export interface JsonTreeSessionState {
  expanded: Set<string>;
  selectedPath: string | null;
  search: string;
  searchOptions: { wholeWord: boolean; caseSensitive: boolean };
}

export function directTreeSearchPatch(search: string): Pick<JsonTreeSessionState, 'search' | 'searchOptions' | 'selectedPath'> {
  return { search, searchOptions: { caseSensitive: false, wholeWord: false }, selectedPath: null };
}

export function JsonTreeView({ source, editable, session, onSessionChange, onSourceChange, onRequestSource }: {
  source: string;
  editable: boolean;
  session: JsonTreeSessionState;
  onSessionChange: (next: JsonTreeSessionState) => void;
  onSourceChange: (next: string) => void;
  onRequestSource: () => void;
}) {
  const analysis = useMemo(() => analyzeJsonSource(source), [source]);
  const [intent, setIntent] = useState<EditIntent | null>(null);
  const [draft, setDraft] = useState('');
  const [keyDraft, setKeyDraft] = useState('');
  const [error, setError] = useState('');
  const selectedRef = useRef<HTMLDivElement | null>(null);
  // Every open JSON tab keeps its tree mounted (inactive ones are `hidden`),
  // so a literal id would repeat across tabs and each `htmlFor` would bind
  // to whichever copy the document happened to reach first.
  const fieldIds = React.useId();
  const query = session.search;

  useEffect(() => { selectedRef.current?.focus(); }, [session.selectedPath, source]);
  useEffect(() => { if (!intent) selectedRef.current?.focus(); }, [intent]);
  if (!analysis.available) {
    return <div className="json-tree-unavailable" role="status"><p>{analysis.message}</p><Button type="button" variant="outline" size="xs" onClick={onRequestSource}>Open Source mode</Button></div>;
  }
  const matches = matchingJsonTreeNodes(analysis.root, query, session.searchOptions);
  const visibleNodes = visibleTreeNodes(analysis.root, session.expanded);
  const selectedMatch = matches.findIndex((node) => formatPath(node.path) === session.selectedPath);
  const updateSession = (patch: Partial<JsonTreeSessionState>) => onSessionChange({ ...session, ...patch });
  const mutate = (operation: () => string, focusPath: string | null) => {
    try {
      const next = operation();
      setError(''); setIntent(null);
      updateSession({ selectedPath: focusPath });
      onSourceChange(next);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  };
  const openIntent = (next: EditIntent) => {
    setIntent(next); setError('');
    updateSession({ selectedPath: formatPath(next.node.path) });
    setKeyDraft(next.kind === 'rename' ? next.node.key ?? '' : '');
    setDraft(next.kind === 'value' || next.kind === 'subtree' ? next.node.raw : next.kind === 'add' ? 'null' : '');
  };
  const applyIntent = () => {
    if (!intent) return;
    const path = formatPath(intent.node.path);
    if (intent.kind === 'rename') mutate(() => renameJsonProperty(source, intent.node.path, keyDraft), formatPath([...intent.node.path.slice(0, -1), keyDraft]));
    else if (intent.kind === 'add') mutate(() => addJsonChild(source, intent.node.path, draft, intent.node.type === 'object' ? keyDraft : undefined), path);
    else mutate(() => replaceJsonNode(source, intent.node, draft, intent.kind === 'subtree'), path);
  };
  const moveMatch = (delta: number) => {
    if (!matches.length) return;
    const index = (selectedMatch + delta + matches.length) % matches.length;
    const node = matches[index];
    const expanded = new Set(session.expanded);
    for (let length = 0; length < node.path.length; length++) expanded.add(formatPath(node.path.slice(0, length)));
    updateSession({ selectedPath: formatPath(node.path), expanded });
  };
  const moveTreeSelection = (node: JsonSourceNode, command: 'previous' | 'next' | 'first' | 'last' | 'parent' | 'child') => {
    const current = visibleNodes.findIndex((candidate) => formatPath(candidate.path) === formatPath(node.path));
    let target: JsonSourceNode | undefined;
    if (command === 'first') target = visibleNodes[0];
    else if (command === 'last') target = visibleNodes.at(-1);
    else if (command === 'previous') target = visibleNodes[Math.max(0, current - 1)];
    else if (command === 'next') target = visibleNodes[Math.min(visibleNodes.length - 1, current + 1)];
    else if (command === 'child') target = node.children[0];
    else target = visibleNodes.find((candidate) => formatPath(candidate.path) === formatPath(node.path.slice(0, -1)));
    if (target) updateSession({ selectedPath: formatPath(target.path) });
  };

  return (
    <section className="json-tree" aria-label="JSON tree">
      <div className="json-tree-search" role="search">
        {/* The name is invisible, not absent: the field sits in a labelled
          * search row, so the text is `sr-only` rather than an `aria-label`
          * — it still binds through `htmlFor`, so it cannot drift from the
          * control the way a floating label string can. */}
        <Field className="flex-1">
          <FieldLabel htmlFor={`${fieldIds}-search`} className="sr-only">Search JSON keys and values</FieldLabel>
          <Input id={`${fieldIds}-search`} className="h-8 text-sm" value={session.search} placeholder="Search keys and values" onChange={(event) => updateSession(directTreeSearchPatch(event.target.value))} />
        </Field>
        <span aria-live="polite">{query ? `${Math.max(0, selectedMatch + 1)} of ${matches.length}` : `${analysis.nodeCount.toLocaleString()} nodes`}</span>
        <Button type="button" variant="ghost" size="icon-xs" disabled={!matches.length} aria-label="Previous JSON tree match" onClick={() => moveMatch(-1)}>↑</Button>
        <Button type="button" variant="ghost" size="icon-xs" disabled={!matches.length} aria-label="Next JSON tree match" onClick={() => moveMatch(1)}>↓</Button>
      </div>
      {error && <div className="json-tree-error" role="alert">{error} <Button type="button" variant="outline" size="xs" onClick={onRequestSource}>Use Source mode</Button></div>}
      <div className="json-tree-scroll" role="tree" aria-label="JSON values">
        <TreeNode node={analysis.root} source={source} editable={editable} expanded={session.expanded} selectedPath={session.selectedPath} selectedRef={selectedRef}
          siblingCount={1}
          positionInSet={1}
          idPrefix={fieldIds}
          onSelect={(selectedPath) => updateSession({ selectedPath })}
          onNavigate={moveTreeSelection}
          onToggle={(path) => { const expanded = new Set(session.expanded); if (expanded.has(path)) expanded.delete(path); else expanded.add(path); updateSession({ expanded }); }}
          onEdit={openIntent}
          onDelete={(node) => mutate(() => deleteJsonPath(source, node.path), formatPath(node.path.slice(0, -1)))}
          onMove={(node, delta) => mutate(() => reorderJsonArrayItem(source, node.path.slice(0, -1), Number(node.path.at(-1)), Number(node.path.at(-1)) + delta), formatPath(node.path.slice(0, -1).concat(Number(node.path.at(-1)) + delta)))}
        />
      </div>
      {/* The panel's visible title IS its accessible name — `aria-labelledby`
        * rather than an `aria-label` repeating the same string, which would
        * be free to drift from the text beside it. */}
      {intent && <div className="json-tree-editor" role="group" aria-labelledby={`${fieldIds}-intent`}>
        <SectionHeading level={3} id={`${fieldIds}-intent`}>{intentLabel(intent)}</SectionHeading>
        {(intent.kind === 'rename' || (intent.kind === 'add' && intent.node.type === 'object')) && (
          <Field className="gap-1">
            <FieldLabel htmlFor={`${fieldIds}-key`} className={JSON_FIELD_LABEL_CLASS}>Key</FieldLabel>
            <Input id={`${fieldIds}-key`} className="h-8 font-mono text-sm" autoFocus value={keyDraft} onChange={(event) => setKeyDraft(event.target.value)} />
          </Field>
        )}
        {intent.kind !== 'rename' && (
          <Field className="gap-1">
            <FieldLabel htmlFor={`${fieldIds}-value`} className={JSON_FIELD_LABEL_CLASS}>JSON value</FieldLabel>
            <Textarea id={`${fieldIds}-value`} className="font-mono text-sm" autoFocus={intent.kind !== 'add' || intent.node.type !== 'object'} value={draft} onChange={(event) => setDraft(event.target.value)} rows={Math.min(10, Math.max(2, draft.split(/\r?\n/u).length))} />
          </Field>
        )}
        <div className="flex gap-1.5"><Button type="button" size="xs" onClick={applyIntent}>Apply</Button><Button type="button" variant="ghost" size="xs" onClick={() => { setIntent(null); setError(''); }}>Cancel</Button></div>
      </div>}
    </section>
  );
}

function TreeNode({ node, source, editable, expanded, selectedPath, selectedRef, siblingCount, positionInSet, idPrefix, onSelect, onNavigate, onToggle, onEdit, onDelete, onMove }: {
  node: JsonSourceNode; source: string; editable: boolean; expanded: Set<string>; selectedPath: string | null;
  siblingCount: number;
  positionInSet: number;
  idPrefix: string;
  selectedRef: React.RefObject<HTMLDivElement | null>; onSelect: (path: string) => void; onToggle: (path: string) => void;
  onNavigate: (node: JsonSourceNode, command: 'previous' | 'next' | 'first' | 'last' | 'parent' | 'child') => void;
  onEdit: (intent: EditIntent) => void; onDelete: (node: JsonSourceNode) => void; onMove: (node: JsonSourceNode, delta: number) => void;
}) {
  const path = formatPath(node.path);
  const container = node.type === 'object' || node.type === 'array';
  const isExpanded = node.path.length === 0 || expanded.has(path);
  const selected = selectedPath === path;
  const index = typeof node.path.at(-1) === 'number' ? Number(node.path.at(-1)) : -1;
  /* The children group renders as a DOM *sibling* of its treeitem row (the
   * wrapper div is layout-only, role="presentation"), so ownership is
   * declared instead: `aria-owns` from the row to the group id. Ids are
   * namespaced per tree instance — every open JSON tab keeps its tree
   * mounted, so a bare path would repeat across tabs — and the path
   * segment is URI-encoded because JSON keys may contain spaces. */
  const groupId = `${idPrefix}-group-${encodeURIComponent(path)}`;
  return <div className="json-tree-node" role="presentation">
    <div ref={selected ? selectedRef : undefined} className="json-tree-row" role="treeitem" tabIndex={selected || (!selectedPath && node.path.length === 0) ? 0 : -1} aria-selected={selected} aria-expanded={container ? isExpanded : undefined}
      aria-level={node.path.length + 1} aria-posinset={positionInSet} aria-setsize={siblingCount}
      aria-owns={container && isExpanded ? groupId : undefined}
      onFocus={() => onSelect(path)} onKeyDown={(event) => {
        if (event.key === 'ArrowDown') { event.preventDefault(); onNavigate(node, 'next'); }
        else if (event.key === 'ArrowUp') { event.preventDefault(); onNavigate(node, 'previous'); }
        else if (event.key === 'Home') { event.preventDefault(); onNavigate(node, 'first'); }
        else if (event.key === 'End') { event.preventDefault(); onNavigate(node, 'last'); }
        else if (event.key === 'ArrowRight' && container) { event.preventDefault(); if (isExpanded) onNavigate(node, 'child'); else onToggle(path); }
        else if (event.key === 'ArrowLeft') { event.preventDefault(); if (container && isExpanded && node.path.length) onToggle(path); else if (node.path.length) onNavigate(node, 'parent'); }
        if (event.key === 'Enter' && editable) { event.preventDefault(); onEdit({ kind: container ? 'subtree' : 'value', node }); }
      }}>
      {container ? <Button type="button" variant="ghost" size="icon-xs" className="json-tree-disclosure" tabIndex={-1} aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${path}`} onClick={() => onToggle(path)}>{isExpanded ? '▾' : '▸'}</Button> : <span className="json-tree-leaf">•</span>}
      <code className="json-tree-key">{node.key !== undefined ? JSON.stringify(node.key) : typeof node.path.at(-1) === 'number' ? `[${node.path.at(-1)}]` : '$'}</code>
      <span className={cn('json-tree-type', `json-tree-type-${node.type}`)}>{node.type}</span>
      <code className="json-tree-value" title={path}>{container ? `${node.type === 'object' ? '{' : '['}${node.children.length}${node.type === 'object' ? '}' : ']'}` : node.raw}</code>
      {/* Action buttons nested inside a treeitem are a known APG deviation
        * kept for its editing ergonomics; each carries the row's path in
        * its name so "Edit"/"Delete" are distinguishable out of context. */}
      {editable && <span className="json-tree-actions">
        <Button type="button" variant="ghost" size="xs" tabIndex={selected ? 0 : -1} aria-label={`Edit ${path}`} onClick={() => onEdit({ kind: container ? 'subtree' : 'value', node })}>{container ? 'Edit JSON' : 'Edit'}</Button>
        {node.key !== undefined && <Button type="button" variant="ghost" size="xs" tabIndex={selected ? 0 : -1} aria-label={`Rename ${path}`} onClick={() => onEdit({ kind: 'rename', node })}>Rename</Button>}
        {container && <Button type="button" variant="ghost" size="xs" tabIndex={selected ? 0 : -1} aria-label={`Add to ${path}`} onClick={() => onEdit({ kind: 'add', node })}>Add</Button>}
        {node.path.length > 0 && <Button type="button" variant="ghost" size="xs" tabIndex={selected ? 0 : -1} aria-label={`Delete ${path}`} onClick={() => onDelete(node)}>Delete</Button>}
        {index > 0 && <Button type="button" variant="ghost" size="icon-xs" tabIndex={selected ? 0 : -1} aria-label={`Move ${path} up`} onClick={() => onMove(node, -1)}>↑</Button>}
        {index >= 0 && index < siblingCount - 1 && <Button type="button" variant="ghost" size="icon-xs" tabIndex={selected ? 0 : -1} aria-label={`Move ${path} down`} onClick={() => onMove(node, 1)}>↓</Button>}
      </span>}
    </div>
    {container && isExpanded && <div role="group" id={groupId} className="json-tree-children">{node.children.map((child, childIndex) => <TreeNode key={formatPath(child.path)} siblingCount={node.children.length} positionInSet={childIndex + 1} idPrefix={idPrefix} {...{ node: child, source, editable, expanded, selectedPath, selectedRef, onSelect, onNavigate, onToggle, onEdit, onDelete, onMove }} />)}</div>}
  </div>;
}

function visibleTreeNodes(root: JsonSourceNode, expanded: Set<string>): JsonSourceNode[] {
  return [root, ...((root.type === 'object' || root.type === 'array') && (root.path.length === 0 || expanded.has(formatPath(root.path))) ? root.children.flatMap((child) => visibleTreeNodes(child, expanded)) : [])];
}
function intentLabel(intent: EditIntent): string { return intent.kind === 'rename' ? `Rename ${formatPath(intent.node.path)}` : intent.kind === 'add' ? `Add to ${formatPath(intent.node.path)}` : `Edit ${formatPath(intent.node.path)}`; }
