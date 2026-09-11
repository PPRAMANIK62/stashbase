/**
 * The JSON grid's row vocabulary: the toolbar, a value row, and the two
 * inline editors that replace a row while a key or value is being typed.
 * Every row is a controlled view — it reports intent and renders nothing of
 * its own state beyond the field being edited.
 */
import { Check, ChevronDown, ChevronRight, Plus, Trash2, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { caretOffsetAtPoint, InlineInput } from '@/components/ui/inline-input';
import { TableCell, TableRow } from '@/components/ui/table';
import { Tooltip } from '@/components/ui/tooltip';
import { formatJsonPath, type JsonSourceNode } from '@/features/documents/domain/json-source';
import { focusRing } from '@/lib/focus-ring';
import { cn } from '@/lib/utils';

import {
  isJsonContainer,
  jsonNodeDisplayValue,
  jsonNodeEditableValue,
  jsonNodeLabel,
  jsonNodeSourceValue,
  type JsonEditIntent,
  type VisibleJsonNode,
} from './tree-model';

export function JsonTreeToolbar({ actions }: { actions?: ReactNode }) {
  return (
    <div className="flex h-9 shrink-0 items-center gap-2 px-3">
      <span className="text-caption font-medium text-muted-foreground">Preview</span>
      {actions && <div className="ml-auto flex items-center gap-1">{actions}</div>}
    </div>
  );
}

export function JsonAddButton({
  onAdd,
  target,
}: {
  onAdd(target: JsonSourceNode): void;
  target: JsonSourceNode | null;
}) {
  return (
    <Tooltip
      content={
        target
          ? target.type === 'object'
            ? 'Add property'
            : 'Add item'
          : 'Select an object or array'
      }
    >
      <Button
        aria-label={target?.type === 'array' ? 'Add item' : 'Add property'}
        disabled={!target}
        onClick={() => target && onAdd(target)}
        size="icon-compact"
        variant="ghost"
      >
        <Plus />
      </Button>
    </Tooltip>
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
  const container = isJsonContainer(node);
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
      <span className="min-w-0 truncate text-foreground">{jsonNodeLabel(node)}</span>
    </div>
  );
}

function JsonCellError({ message }: { message: string }) {
  return (
    <span className="mt-1 block font-sans text-caption text-destructive" role="alert">
      {message}
    </span>
  );
}

export interface JsonValueRowProps {
  editable: boolean;
  isExpanded: boolean;
  isSelected: boolean;
  item: VisibleJsonNode;
  onDelete(node: JsonSourceNode): void;
  onEdit(intent: JsonEditIntent): void;
  onKeyDown(key: string, item: VisibleJsonNode, preventDefault: () => void): void;
  onSelect(node: JsonSourceNode): void;
  onToggle(node: JsonSourceNode): void;
  rowIndex: number;
  selectedRef: React.Ref<HTMLTableRowElement>;
}

export function JsonValueRow({
  editable,
  isExpanded,
  isSelected,
  item,
  onDelete,
  onEdit,
  onKeyDown,
  onSelect,
  onToggle,
  rowIndex,
  selectedRef,
}: JsonValueRowProps) {
  const { node, position, setSize } = item;
  const container = isJsonContainer(node);
  const deletable = editable && node.path.length > 0;

  return (
    <TableRow
      aria-expanded={container ? isExpanded : undefined}
      aria-level={node.path.length + 1}
      aria-keyshortcuts={deletable ? 'Delete' : undefined}
      aria-posinset={position}
      aria-selected={isSelected}
      aria-setsize={setSize}
      className={cn(
        'cursor-default outline-none',
        isSelected && 'bg-hover [&>td]:text-foreground',
        focusRing('focus-visible:ring-inset'),
      )}
      data-json-node-row=""
      index={rowIndex}
      onClick={() => onSelect(node)}
      onKeyDown={(event) => onKeyDown(event.key, item, () => event.preventDefault())}
      ref={isSelected ? selectedRef : undefined}
      tabIndex={isSelected ? 0 : -1}
    >
      <TableCell
        onDoubleClick={() => editable && node.key !== undefined && onEdit({ kind: 'rename', node })}
      >
        <JsonKeyCell isExpanded={isExpanded} node={node} onToggle={() => onToggle(node)} />
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
          onEdit({
            caretOffset: caretOffsetAtPoint(event.currentTarget, event.clientX, event.clientY),
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
        {deletable && (
          <Tooltip content="Delete value">
            <Button
              aria-label={`Delete ${jsonNodeLabel(node)}`}
              className="pointer-events-none text-destructive opacity-0 group-hover/row:pointer-events-auto group-hover/row:opacity-100 hover:text-destructive"
              onClick={(event) => {
                event.stopPropagation();
                onDelete(node);
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
  );
}

export function JsonInlineEditRow({
  error,
  intent,
  isExpanded,
  item,
  onCancel,
  onSubmit,
  onToggle,
}: {
  error: string | null;
  intent: Exclude<JsonEditIntent, { kind: 'add' }>;
  isExpanded: boolean;
  item: VisibleJsonNode;
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
      className="bg-hover [&>td]:text-foreground"
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
            <InlineInput
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
          <InlineInput
            aria-label="JSON value"
            {...(intent.kind === 'replace' && intent.caretOffset !== undefined
              ? { caretOffset: intent.caretOffset }
              : {})}
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

export function JsonInlineAddRow({
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
            <InlineInput
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
        <InlineInput
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
