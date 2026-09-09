/**
 * The JSON outline: a treegrid over the parsed source with in-place editing.
 *
 * Every edit is applied to the source text and handed straight back up, so
 * this view holds no copy of the document — only which row is selected and
 * which edit is open. Row rendering lives in `tree-rows`, the projection in
 * `tree-model`, and the keyboard contract in `tree-keyboard`.
 */
import { X } from 'lucide-react';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { jsonEditFailureMessage } from '@/features/documents/application/failure-messages';
import type { JsonDocumentSession } from '@/features/documents/domain/document';
import {
  addJsonChild,
  deleteJsonPath,
  renameJsonProperty,
  replaceJsonNode,
} from '@/features/documents/domain/json-edit';
import {
  analyzeJsonSource,
  formatJsonPath,
  type JsonSourceNode,
} from '@/features/documents/domain/json-source';

import { jsonTreeKeyCommand } from './tree-keyboard';
import {
  isJsonContainer,
  jsonTableValueSource,
  lastVisibleDescendantIndex,
  visibleJsonNodes,
  type JsonEditIntent,
  type VisibleJsonNode,
} from './tree-model';
import {
  JsonAddButton,
  JsonInlineAddRow,
  JsonInlineEditRow,
  JsonTreeToolbar,
  JsonValueRow,
} from './tree-rows';

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
  const [intent, setIntent] = useState<JsonEditIntent | null>(null);
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
  const selectedItem = visible[selectedIndex] ?? visible[0];
  const selected = selectedItem.node;
  const addTarget = isJsonContainer(selected)
    ? selected
    : selectedItem.parent && isJsonContainer(selectedItem.parent)
      ? selectedItem.parent
      : null;
  const addAfterIndex =
    intent?.kind === 'add' ? lastVisibleDescendantIndex(visible, intent.node.path) : -1;

  const publishExpanded = (next: Set<string>) => onSessionChange({ expandedPaths: [...next] });
  const focusSelected = () =>
    queueMicrotask(() => selectedRef.current?.focus({ preventScroll: true }));
  const selectNode = (node: JsonSourceNode, focus = false) => {
    onSessionChange({ selectedPath: formatJsonPath(node.path) });
    if (focus) focusSelected();
  };
  const toggleNode = (node: JsonSourceNode) => {
    const path = formatJsonPath(node.path);
    const next = new Set(expanded);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    publishExpanded(next);
  };
  const beginEdit = (nextIntent: JsonEditIntent) => {
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
      setError(jsonEditFailureMessage(caught));
    }
  };
  const cancelEdit = () => {
    setError(null);
    setIntent(null);
    focusSelected();
  };
  const deleteNode = (node: JsonSourceNode) =>
    apply(() => deleteJsonPath(source, node.path), formatJsonPath(node.path.slice(0, -1)));

  const onRowKeyDown = (key: string, item: VisibleJsonNode, preventDefault: () => void) => {
    const result = jsonTreeKeyCommand(key, { editable, expanded, item, visible });
    if (!result) return;
    if (result.preventDefault) preventDefault();
    const command = result.command;
    if (command.kind === 'select') selectNode(command.node, true);
    else if (command.kind === 'toggle') toggleNode(command.node);
    else if (command.kind === 'edit') beginEdit(command.intent);
    else if (command.kind === 'delete') deleteNode(command.node);
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
            <JsonAddButton
              onAdd={(target) => beginEdit({ kind: 'add', node: target })}
              target={addTarget}
            />
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
                <TableHead className="w-16 px-1" scope="col">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((item, rowIndex) => {
                const { node } = item;
                const path = formatJsonPath(node.path);
                const isSelected = path === formatJsonPath(selected.path);
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
                        item={item}
                        onCancel={cancelEdit}
                        onSubmit={(key, value) => {
                          if (activeIntent.kind === 'rename') {
                            apply(
                              () => renameJsonProperty(source, node.path, key),
                              formatJsonPath([...node.path.slice(0, -1), key]),
                            );
                          } else {
                            apply(() =>
                              replaceJsonNode(source, node, value, isJsonContainer(node)),
                            );
                          }
                        }}
                        onToggle={() => isJsonContainer(node) && toggleNode(node)}
                      />
                    ) : (
                      <JsonValueRow
                        editable={editable}
                        isExpanded={isExpanded}
                        isSelected={isSelected}
                        item={item}
                        onDelete={deleteNode}
                        onEdit={beginEdit}
                        onKeyDown={onRowKeyDown}
                        onSelect={selectNode}
                        onToggle={toggleNode}
                        rowIndex={rowIndex}
                        selectedRef={selectedRef}
                      />
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
