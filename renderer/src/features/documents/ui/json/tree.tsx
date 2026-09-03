import { Check, ChevronDown, ChevronRight, Plus, Trash2, X } from 'lucide-react';
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip } from '@/components/ui/tooltip';
import type { JsonDocumentSession } from '@/features/documents/domain/document';
import {
  addJsonChild,
  analyzeJsonSource,
  deleteJsonPath,
  formatJsonPath,
  renameJsonProperty,
  replaceJsonNode,
  type JsonSourceNode,
} from '@/features/documents/domain/json-source';
import { cn } from '@/lib/utils';

type EditIntent =
  | { kind: 'add'; node: JsonSourceNode }
  | { kind: 'rename'; node: JsonSourceNode }
  | { caretOffset?: number; kind: 'replace'; node: JsonSourceNode };

interface VisibleNode {
  node: JsonSourceNode;
  parent: JsonSourceNode | null;
  position: number;
  setSize: number;
}

export interface JsonTreeProps {
  active: boolean;
  editable: boolean;
  onActivate(): void;
  onChange(value: string): void;
  onSessionChange(patch: Partial<JsonDocumentSession>): void;
  session: JsonDocumentSession;
  source: string;
}

export function JsonTree({
  active,
  editable,
  onActivate,
  onChange,
  onSessionChange,
  session,
  source,
}: JsonTreeProps) {
  const analysis = useMemo(() => analyzeJsonSource(source), [source]);
  const selectedRef = useRef<HTMLTableRowElement | null>(null);
  const [intent, setIntent] = useState<EditIntent | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    selectedRef.current?.focus({ preventScroll: true });
  }, [session.selectedPath]);

  if (!analysis.available) {
    return (
      <section aria-label="JSON outline" className="flex min-h-0 min-w-0 flex-col">
        <JsonTreeToolbar />
        <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-10 text-center">
          <div className="max-w-sm">
            <p className="text-body text-muted-foreground" role="status">
              {analysis.message}
            </p>
          </div>
        </div>
      </section>
    );
  }

  const expanded = new Set(session.expandedPaths);
  const visible = visibleJsonNodes(analysis.root, expanded);
  const selectedIndex = Math.max(
    0,
    visible.findIndex(({ node }) => formatJsonPath(node.path) === session.selectedPath),
  );
  const selectedItem = visible[selectedIndex] ?? visible[0]!;
  const selected = selectedItem.node;
  const selectedContainer = isContainer(selected);
  const addTarget = selectedContainer
    ? selected
    : selectedItem.parent && isContainer(selectedItem.parent)
      ? selectedItem.parent
      : null;
  const addAfterIndex =
    intent?.kind === 'add' ? lastVisibleDescendantIndex(visible, intent.node.path) : -1;

  const publishExpanded = (next: Set<string>) => onSessionChange({ expandedPaths: [...next] });
  const selectNode = (node: JsonSourceNode, focus = false) => {
    onSessionChange({ selectedPath: formatJsonPath(node.path) });
    if (focus) queueMicrotask(() => selectedRef.current?.focus({ preventScroll: true }));
  };
  const toggleNode = (node: JsonSourceNode) => {
    const path = formatJsonPath(node.path);
    const next = new Set(expanded);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    publishExpanded(next);
  };
  const beginEdit = (nextIntent: EditIntent) => {
    setError(null);
    setIntent(nextIntent);
    if (nextIntent.kind === 'add') {
      const next = new Set(expanded);
      next.add(formatJsonPath(nextIntent.node.path));
      publishExpanded(next);
    }
  };
  const apply = (operation: () => string, selectedPath?: string | null) => {
    try {
      const next = operation();
      setError(null);
      setIntent(null);
      onSessionChange({ selectedPath: selectedPath ?? session.selectedPath });
      onChange(next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The JSON edit could not be applied.');
    }
  };
  const cancelEdit = () => {
    setError(null);
    setIntent(null);
    queueMicrotask(() => selectedRef.current?.focus({ preventScroll: true }));
  };
  const onTreeKeyDown = (event: React.KeyboardEvent<HTMLTableRowElement>, item: VisibleNode) => {
    const index = visible.indexOf(item);
    const container = isContainer(item.node);
    const path = formatJsonPath(item.node.path);
    let next: JsonSourceNode | null = null;
    if (event.key === 'ArrowDown') next = visible[Math.min(index + 1, visible.length - 1)]?.node;
    else if (event.key === 'ArrowUp') next = visible[Math.max(index - 1, 0)]?.node;
    else if (event.key === 'Home') next = visible[0]?.node;
    else if (event.key === 'End') next = visible.at(-1)?.node ?? null;
    else if (event.key === 'ArrowRight' && container) {
      if (!expanded.has(path)) toggleNode(item.node);
      else next = item.node.children[0] ?? null;
    } else if (event.key === 'ArrowLeft') {
      if (container && expanded.has(path)) toggleNode(item.node);
      else next = item.parent;
    } else if (event.key === 'Enter' && editable && !container) {
      beginEdit({ kind: 'replace', node: item.node });
      return;
    } else if (event.key === 'F2' && editable && item.node.key !== undefined) {
      beginEdit({ kind: 'rename', node: item.node });
      return;
    } else if (event.key === 'Delete' && editable && item.node.path.length > 0) {
      event.preventDefault();
      apply(
        () => deleteJsonPath(source, item.node.path),
        formatJsonPath(item.node.path.slice(0, -1)),
      );
      return;
    } else return;
    event.preventDefault();
    if (next) selectNode(next, true);
  };

  return (
    <section
      aria-label="JSON outline"
      className="relative flex min-h-0 min-w-0 flex-col"
      data-active={active ? '' : undefined}
      data-json-tree=""
      onFocusCapture={onActivate}
      onPointerDown={onActivate}
    >
      <JsonTreeToolbar
        actions={
          editable ? (
            <Tooltip
              content={
                addTarget
                  ? addTarget.type === 'object'
                    ? 'Add property'
                    : 'Add item'
                  : 'Select an object or array'
              }
            >
              <Button
                aria-label={addTarget?.type === 'array' ? 'Add item' : 'Add property'}
                disabled={!addTarget}
                onClick={() => addTarget && beginEdit({ kind: 'add', node: addTarget })}
                size="icon-compact"
                variant="ghost"
              >
                <Plus />
              </Button>
            </Tooltip>
          ) : null
        }
      />

      <ScrollArea className="min-h-0 flex-1" orientation="both">
        <div className="min-w-[30rem] pb-4">
          <Table
            aria-label="JSON values"
            className="table-fixed font-mono"
            role="treegrid"
            size="compact"
          >
            <colgroup>
              <col className="w-[36%]" />
              <col className="w-[40%]" />
              <col />
              <col className="w-16" />
            </colgroup>
            <TableHeader className="sticky top-0 z-10 bg-surface-2 font-sans text-caption">
              <TableRow>
                <TableHead className="pl-10" scope="col">
                  Key
                </TableHead>
                <TableHead scope="col">Value</TableHead>
                <TableHead scope="col">Type</TableHead>
                <TableHead aria-label="Actions" className="w-16 px-1" scope="col" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((item, rowIndex) => {
                const { node, position, setSize } = item;
                const path = formatJsonPath(node.path);
                const isSelected = path === formatJsonPath(selected.path);
                const container = isContainer(node);
                const isExpanded = expanded.has(path);
                const activeIntent =
                  intent && intent.kind !== 'add' && formatJsonPath(intent.node.path) === path
                    ? intent
                    : null;

                return (
                  <Fragment key={path}>
                    {activeIntent ? (
                      <JsonInlineEditRow
                        error={error}
                        intent={activeIntent}
                        isExpanded={isExpanded}
                        onCancel={cancelEdit}
                        onSubmit={(key, value) => {
                          if (activeIntent.kind === 'rename') {
                            apply(
                              () => renameJsonProperty(source, node.path, key),
                              formatJsonPath([...node.path.slice(0, -1), key]),
                            );
                          } else {
                            apply(() => replaceJsonNode(source, node, value, container));
                          }
                        }}
                        onToggle={() => container && toggleNode(node)}
                        item={item}
                      />
                    ) : (
                      <TableRow
                        aria-expanded={container ? isExpanded : undefined}
                        aria-level={node.path.length + 1}
                        aria-keyshortcuts={editable && node.path.length > 0 ? 'Delete' : undefined}
                        aria-posinset={position}
                        aria-selected={isSelected}
                        aria-setsize={setSize}
                        className={cn(
                          'cursor-default outline-none',
                          isSelected && 'bg-active [&>td]:text-foreground',
                          'focus-visible:ring-1 focus-visible:ring-border focus-visible:ring-inset',
                        )}
                        data-json-node-row=""
                        index={rowIndex}
                        onClick={() => selectNode(node)}
                        onKeyDown={(event) => onTreeKeyDown(event, item)}
                        ref={isSelected ? selectedRef : undefined}
                        tabIndex={isSelected ? 0 : -1}
                      >
                        <TableCell
                          onDoubleClick={() =>
                            editable &&
                            node.key !== undefined &&
                            beginEdit({ kind: 'rename', node })
                          }
                        >
                          <JsonKeyCell
                            isExpanded={isExpanded}
                            node={node}
                            onToggle={() => toggleNode(node)}
                          />
                        </TableCell>
                        <TableCell
                          className={cn(
                            'truncate',
                            editable && !container && 'cursor-text',
                            node.type !== 'string' && 'text-foreground',
                          )}
                          onDoubleClick={(event) => {
                            if (!editable || container) return;
                            event.preventDefault();
                            beginEdit({
                              caretOffset: caretOffsetAtPoint(
                                event.currentTarget,
                                event.clientX,
                                event.clientY,
                              ),
                              kind: 'replace',
                              node,
                            });
                          }}
                          title={node.raw}
                        >
                          {jsonNodeDisplayValue(node)}
                        </TableCell>
                        <TableCell className="font-sans text-caption">{node.type}</TableCell>
                        <TableCell className="w-16 px-1 py-0 text-right">
                          {editable && node.path.length > 0 && (
                            <Tooltip content="Delete value">
                              <Button
                                aria-label={`Delete ${nodeLabel(node)}`}
                                className="pointer-events-none text-destructive opacity-0 group-hover/row:pointer-events-auto group-hover/row:opacity-100 hover:text-destructive"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  apply(
                                    () => deleteJsonPath(source, node.path),
                                    formatJsonPath(node.path.slice(0, -1)),
                                  );
                                }}
                                size="icon-compact"
                                tabIndex={-1}
                                type="button"
                                variant="ghost"
                              >
                                <Trash2 />
                              </Button>
                            </Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
                    )}

                    {intent?.kind === 'add' && rowIndex === addAfterIndex && (
                      <JsonInlineAddRow
                        error={error}
                        node={intent.node}
                        onCancel={cancelEdit}
                        onSubmit={(key, value) => {
                          const nextPath =
                            intent.node.type === 'object'
                              ? [...intent.node.path, key]
                              : [...intent.node.path, intent.node.children.length];
                          apply(
                            () =>
                              addJsonChild(
                                source,
                                intent.node.path,
                                jsonTableValueSource(value),
                                intent.node.type === 'object' ? key : undefined,
                              ),
                            formatJsonPath(nextPath),
                          );
                        }}
                      />
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </ScrollArea>

      {error && !intent && (
        <div className="flex min-h-7 shrink-0 items-center gap-2 px-3 py-1 text-caption">
          <span className="min-w-0 flex-1 truncate text-destructive" role="alert" title={error}>
            {error}
          </span>
          <Button
            aria-label="Dismiss JSON edit error"
            onClick={() => setError(null)}
            size="icon-compact"
            variant="ghost"
          >
            <X />
          </Button>
        </div>
      )}
    </section>
  );
}

function JsonTreeToolbar({ actions }: { actions?: ReactNode }) {
  return (
    <div className="flex h-9 shrink-0 items-center gap-2 px-3">
      <span className="text-caption font-medium text-muted-foreground">Preview</span>
      {actions && <div className="ml-auto flex items-center gap-1">{actions}</div>}
    </div>
  );
}

function JsonKeyCell({
  isExpanded,
  node,
  onToggle,
}: {
  isExpanded: boolean;
  node: JsonSourceNode;
  onToggle(): void;
}) {
  const container = isContainer(node);
  return (
    <div
      className="flex min-w-0 items-center gap-1 pr-4"
      style={{ paddingLeft: `${Math.max(0, node.path.length) * 16}px` }}
    >
      {container ? (
        <Button
          aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${formatJsonPath(node.path)}`}
          className="shrink-0"
          onClick={(event) => {
            event.stopPropagation();
            onToggle();
          }}
          size="icon-compact"
          tabIndex={-1}
          type="button"
          variant="ghost"
        >
          {isExpanded ? <ChevronDown /> : <ChevronRight />}
        </Button>
      ) : (
        <span aria-hidden="true" className="size-7 shrink-0" />
      )}
      <span className="min-w-0 truncate text-foreground">{nodeLabel(node)}</span>
    </div>
  );
}

function JsonInlineEditRow({
  error,
  intent,
  isExpanded,
  item,
  onCancel,
  onSubmit,
  onToggle,
}: {
  error: string | null;
  intent: Exclude<EditIntent, { kind: 'add' }>;
  isExpanded: boolean;
  item: VisibleNode;
  onCancel(): void;
  onSubmit(key: string, value: string): void;
  onToggle(): void;
}) {
  const { node, position, setSize } = item;
  const [key, setKey] = useState(node.key ?? '');
  const initialValue = jsonNodeEditableValue(node);
  const [value, setValue] = useState(initialValue);
  const renaming = intent.kind === 'rename';

  return (
    <TableRow
      aria-label={`Editing ${formatJsonPath(node.path)}`}
      aria-level={node.path.length + 1}
      aria-posinset={position}
      aria-selected="true"
      aria-setsize={setSize}
      className="bg-active [&>td]:text-foreground"
      data-json-inline-editor=""
      tabIndex={-1}
    >
      <TableCell className={cn('relative', renaming && 'bg-card ring-1 ring-border ring-inset')}>
        {renaming ? (
          <div
            className="flex min-w-0 items-center gap-1"
            style={{ paddingLeft: `${Math.max(0, node.path.length) * 16}px` }}
          >
            <span aria-hidden="true" className="size-7 shrink-0" />
            <JsonCellInput
              aria-label="Key"
              onCancel={onCancel}
              onChange={setKey}
              onCommit={() => (key === node.key ? onCancel() : onSubmit(key, value))}
              value={key}
            />
          </div>
        ) : (
          <JsonKeyCell isExpanded={isExpanded} node={node} onToggle={onToggle} />
        )}
        {renaming && error && <JsonCellError message={error} />}
      </TableCell>
      <TableCell className={cn('relative', !renaming && 'bg-card ring-1 ring-border ring-inset')}>
        {renaming ? (
          <span className="block truncate text-muted-foreground" title={node.raw}>
            {jsonNodeDisplayValue(node)}
          </span>
        ) : (
          <JsonCellInput
            aria-label="JSON value"
            caretOffset={intent.kind === 'replace' ? intent.caretOffset : undefined}
            onCancel={onCancel}
            onChange={setValue}
            onCommit={() =>
              value === initialValue ? onCancel() : onSubmit(key, jsonNodeSourceValue(node, value))
            }
            spellCheck={false}
            value={value}
          />
        )}
        {!renaming && error && <JsonCellError message={error} />}
      </TableCell>
      <TableCell className="font-sans text-caption">{node.type}</TableCell>
      <TableCell aria-hidden="true" className="w-16 px-1 py-0" />
    </TableRow>
  );
}

function JsonCellInput({
  caretOffset,
  commitOnBlur = true,
  focusOnMount = true,
  onCancel,
  onChange,
  onCommit,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> & {
  caretOffset?: number;
  commitOnBlur?: boolean;
  focusOnMount?: boolean;
  onCancel(): void;
  onChange(value: string): void;
  onCommit(): void;
}) {
  const ref = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const input = ref.current;
    if (!input || !focusOnMount) return;
    input.focus();
    const offset = Math.min(Math.max(caretOffset ?? input.value.length, 0), input.value.length);
    input.setSelectionRange(offset, offset);
  }, [caretOffset, focusOnMount]);

  return (
    <input
      {...props}
      className="block w-full rounded-none bg-transparent p-0 font-mono text-foreground outline-none"
      onBlur={commitOnBlur ? onCommit : undefined}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Enter') {
          event.preventDefault();
          onCommit();
        } else if (event.key === 'Escape') {
          event.preventDefault();
          onCancel();
        }
      }}
      ref={ref}
    />
  );
}

function JsonCellError({ message }: { message: string }) {
  return (
    <span className="mt-1 block font-sans text-caption text-destructive" role="alert">
      {message}
    </span>
  );
}

function JsonInlineAddRow({
  error,
  node,
  onCancel,
  onSubmit,
}: {
  error: string | null;
  node: JsonSourceNode;
  onCancel(): void;
  onSubmit(key: string, value: string): void;
}) {
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const objectAdd = node.type === 'object';
  const submit = () => {
    if (objectAdd && key.length === 0) return;
    onSubmit(key, value);
  };

  return (
    <TableRow
      aria-label={`Adding to ${formatJsonPath(node.path)}`}
      className="[&>td]:text-foreground"
      data-json-inline-editor=""
    >
      <TableCell
        className={cn(
          'relative',
          objectAdd &&
            'bg-card focus-within:ring-1 focus-within:ring-border focus-within:ring-inset',
        )}
      >
        <div
          className="flex min-w-0 items-center gap-1"
          style={{ paddingLeft: `${(node.path.length + 1) * 16}px` }}
        >
          <span aria-hidden="true" className="size-7 shrink-0" />
          {objectAdd ? (
            <JsonCellInput
              aria-label="New property key"
              commitOnBlur={false}
              onCancel={onCancel}
              onChange={setKey}
              onCommit={submit}
              placeholder="Key"
              value={key}
            />
          ) : (
            <span className="font-sans text-caption text-muted-foreground">
              [{node.children.length}]
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="relative bg-card focus-within:ring-1 focus-within:ring-border focus-within:ring-inset">
        <JsonCellInput
          aria-label="New JSON value"
          commitOnBlur={false}
          focusOnMount={!objectAdd}
          onCancel={onCancel}
          onChange={setValue}
          onCommit={submit}
          placeholder="Value"
          spellCheck={false}
          value={value}
        />
        {error && <JsonCellError message={error} />}
      </TableCell>
      <TableCell className="font-sans text-caption">new</TableCell>
      <TableCell className="w-16 px-1 py-0">
        <span className="flex shrink-0 items-center justify-end">
          <Tooltip content="Add value">
            <Button
              aria-label="Add value"
              disabled={objectAdd && key.length === 0}
              onClick={submit}
              size="icon-compact"
              type="button"
              variant="ghost"
            >
              <Check />
            </Button>
          </Tooltip>
          <Tooltip content="Cancel">
            <Button
              aria-label="Cancel add"
              onClick={onCancel}
              size="icon-compact"
              type="button"
              variant="ghost"
            >
              <X />
            </Button>
          </Tooltip>
        </span>
      </TableCell>
    </TableRow>
  );
}

function isContainer(node: JsonSourceNode): boolean {
  return node.type === 'array' || node.type === 'object';
}

function jsonTableValueSource(value: string): string {
  const trimmed = value.trim();
  if (!looksLikeJsonSyntax(trimmed)) return JSON.stringify(value);

  const analysis = analyzeJsonSource(trimmed);
  if (!analysis.available) {
    const detail = analysis.message.replace(/\s*Fix it in Source mode\.?$/u, '');
    throw new Error(`Invalid JSON value: ${detail}`);
  }
  return trimmed;
}

function looksLikeJsonSyntax(value: string): boolean {
  if (value.startsWith('[') || value.startsWith('{') || value.startsWith('"')) return true;
  if (/^(?:true|false|null)$/u.test(value)) return true;
  return /^(?:-?(?:\d|\.)|NaN$|Infinity$|-Infinity$)/u.test(value);
}

function nodeLabel(node: JsonSourceNode): string {
  if (node.key !== undefined) return node.key;
  const index = node.path.at(-1);
  return typeof index === 'number' ? `[${index}]` : 'Root';
}

function containerSummary(node: JsonSourceNode): string {
  const count = node.children.length;
  if (node.type === 'array') return `${count.toLocaleString()} ${count === 1 ? 'item' : 'items'}`;
  return `${count.toLocaleString()} ${count === 1 ? 'property' : 'properties'}`;
}

function jsonNodeDisplayValue(node: JsonSourceNode): string {
  if (isContainer(node)) return containerSummary(node);
  return jsonNodeEditableValue(node);
}

function jsonNodeEditableValue(node: JsonSourceNode): string {
  if (node.type !== 'string') return node.raw;
  const value: unknown = JSON.parse(node.raw);
  return typeof value === 'string' ? value : node.raw;
}

function jsonNodeSourceValue(node: JsonSourceNode, value: string): string {
  return node.type === 'string' ? JSON.stringify(value) : value;
}

function caretOffsetAtPoint(container: HTMLElement, x: number, y: number): number {
  const document = container.ownerDocument;
  const position = document.caretPositionFromPoint?.(x, y);
  const node = position?.offsetNode;
  const offset = position?.offset;
  const fallback = document.caretRangeFromPoint?.(x, y);
  const targetNode = node ?? fallback?.startContainer;
  const targetOffset = offset ?? fallback?.startOffset;
  if (!targetNode || targetOffset === undefined || !container.contains(targetNode)) {
    return container.textContent?.length ?? 0;
  }

  const range = document.createRange();
  range.selectNodeContents(container);
  range.setEnd(targetNode, targetOffset);
  return range.toString().length;
}

function lastVisibleDescendantIndex(visible: VisibleNode[], parentPath: JsonSourceNode['path']) {
  for (let index = visible.length - 1; index >= 0; index -= 1) {
    const path = visible[index]?.node.path;
    if (path && parentPath.every((part, pathIndex) => path[pathIndex] === part)) return index;
  }
  return -1;
}

export function visibleJsonNodes(root: JsonSourceNode, expanded: Set<string>): VisibleNode[] {
  const result: VisibleNode[] = [];
  const visit = (
    node: JsonSourceNode,
    parent: JsonSourceNode | null,
    position: number,
    setSize: number,
  ) => {
    result.push({ node, parent, position, setSize });
    if (isContainer(node) && expanded.has(formatJsonPath(node.path))) {
      node.children.forEach((child, index) => visit(child, node, index + 1, node.children.length));
    }
  };
  visit(root, null, 1, 1);
  return result;
}
