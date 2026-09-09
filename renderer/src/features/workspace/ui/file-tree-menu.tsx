import { ContextMenu } from '@base-ui/react/context-menu';
import {
  ExternalLink,
  FilePlus,
  FolderPlus,
  PencilLine,
  RefreshCw,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { useState, type MouseEvent, type ReactElement, type ReactNode } from 'react';

import type { WorkspaceEntry } from '@/features/workspace/domain/tree';
import { focusRing } from '@/lib/focus-ring';
import { useShape } from '@/lib/shape-context';
import { cn } from '@/lib/utils';

/** Where a right click landed: the tree's own space, or one of its rows. */
export type FileTreeMenuTarget =
  | { kind: 'space' }
  | {
      entry: WorkspaceEntry;
      kind: 'entry';
      /** Reveal is the only action a restricted entry offers. */
      restricted: boolean;
      reprocessable: boolean;
    };

export interface FileTreeMenuActions {
  onCreate(entryKind: WorkspaceEntry['kind'], parentPath: string): void;
  onDelete(entry: WorkspaceEntry): void;
  onRename(entry: WorkspaceEntry): void;
  onReprocess(entry: WorkspaceEntry): void;
  onReveal(entry: WorkspaceEntry): void;
}

interface MenuAction {
  destructive?: boolean;
  icon: LucideIcon;
  label: string;
  run(): void;
  title?: string;
}

type MenuRow = MenuAction | 'separator';

function actionsFor(
  target: FileTreeMenuTarget,
  actions: FileTreeMenuActions,
  revealLabel: string,
): MenuRow[] {
  const create = (parentPath: string): MenuAction[] => [
    { icon: FilePlus, label: 'New file', run: () => actions.onCreate('file', parentPath) },
    { icon: FolderPlus, label: 'New folder', run: () => actions.onCreate('folder', parentPath) },
  ];
  if (target.kind === 'space') return create('');
  const { entry } = target;
  if (target.restricted) {
    return [{ icon: ExternalLink, label: revealLabel, run: () => actions.onReveal(entry) }];
  }
  const own: MenuRow[] = [
    { icon: PencilLine, label: 'Rename', run: () => actions.onRename(entry) },
    { destructive: true, icon: Trash2, label: 'Delete', run: () => actions.onDelete(entry) },
  ];
  if (entry.kind === 'folder') return [...create(entry.path), 'separator', ...own];
  return target.reprocessable
    ? [
        {
          icon: RefreshCw,
          label: 'Reprocess',
          run: () => actions.onReprocess(entry),
          title: 'Rebuild the searchable version of this file',
        },
        'separator',
        ...own,
      ]
    : own;
}

/**
 * One context menu for the whole tree. The trigger is the tree's section;
 * the row under the pointer is read in the capture phase, before the
 * primitive opens, so a single popup serves every row and the space
 * between them without a menu root per row.
 */
export function FileTreeMenu({
  actions,
  children,
  render,
  resolveTarget,
  revealLabel,
}: {
  actions: FileTreeMenuActions;
  children: ReactNode;
  /** The element that becomes the trigger. */
  render: ReactElement;
  resolveTarget(event: MouseEvent<HTMLElement>): FileTreeMenuTarget;
  revealLabel: string;
}) {
  const shape = useShape();
  const [target, setTarget] = useState<FileTreeMenuTarget>({ kind: 'space' });
  const rows = actionsFor(target, actions, revealLabel);

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger
        onContextMenuCapture={(event) => setTarget(resolveTarget(event))}
        render={render}
      >
        {children}
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Positioner className="z-50 outline-none">
          <ContextMenu.Popup
            aria-label={target.kind === 'space' ? 'Files actions' : `${target.entry.path} actions`}
            className={cn(
              'min-w-44 border border-border bg-surface-3 p-1 text-foreground shadow-surface-5 outline-none select-none',
              shape.container,
            )}
          >
            {rows.map((row, index) =>
              row === 'separator' ? (
                <ContextMenu.Separator
                  className="my-1 h-px bg-border"
                  key={`after-${(rows[index - 1] as MenuAction).label}`}
                />
              ) : (
                <ContextMenu.Item
                  className={cn(
                    'flex h-7 cursor-pointer items-center gap-2 px-2 text-[12px] outline-none',
                    focusRing('data-[highlighted]:bg-hover'),
                    row.destructive && 'text-destructive',
                    shape.bg,
                  )}
                  key={row.label}
                  onClick={row.run}
                  title={row.title}
                >
                  <row.icon aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={1.5} />
                  {row.label}
                </ContextMenu.Item>
              ),
            )}
          </ContextMenu.Popup>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
