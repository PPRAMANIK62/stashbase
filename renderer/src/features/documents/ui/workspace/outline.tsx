/**
 * The heading outline for the active document, as a collapsible sidebar tree.
 * A format that never publishes headings says so rather than reading as a
 * document whose outline has not arrived.
 */
import { ChevronDown, ChevronRight, FileText } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useStore } from 'zustand';

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar';
import type { DocumentTabsRuntime } from '@/features/documents/application/tabs-runtime';
import { sourceName } from '@/features/documents/domain/document';
import { documentViewerFormat } from '@/features/documents/domain/document-format';
import {
  buildDocumentOutline,
  type DocumentOutlineNode,
} from '@/features/documents/domain/outline';
import { documentViewerEntry } from '@/features/documents/ui/source/registry';

interface OutlineNodeItemProps {
  collapsed: ReadonlySet<string>;
  depth: number;
  node: DocumentOutlineNode;
  runtime: DocumentTabsRuntime;
  toggle(id: string): void;
}

function OutlineNodeItem({ collapsed, depth, node, runtime, toggle }: OutlineNodeItemProps) {
  const subtreeId = useId();
  const { heading } = node;
  const active = runtime.navigation.store.getState().outline.activeId === heading.id;
  const hasChildren = node.children.length > 0;
  const isCollapsed = collapsed.has(heading.id);
  const label = heading.text || 'Untitled section';
  const buttonProps = {
    'aria-current': active ? ('location' as const) : undefined,
    'aria-label': `Heading level ${heading.level}: ${label}`,
    className: 'pl-8',
    isActive: active,
    onClick: () => runtime.navigation.selectHeading(heading),
    style: {
      '--row-gutter': '8px',
      '--row-gutter-hover': '8px',
    } as CSSProperties,
    title: label,
  };
  const button =
    depth === 0 ? (
      <SidebarMenuButton {...buttonProps} label={label} />
    ) : (
      <SidebarMenuSubButton
        {...buttonProps}
        label={label}
        render={<button aria-label={buttonProps['aria-label']} type="button" />}
      />
    );
  const branch = (
    <>
      {button}
      {hasChildren && (
        <SidebarMenuAction
          aria-controls={subtreeId}
          aria-expanded={!isCollapsed}
          aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${label}`}
          className="right-auto left-1"
          onClick={() => toggle(heading.id)}
          title={`${isCollapsed ? 'Expand' : 'Collapse'} ${label}`}
        >
          {isCollapsed ? <ChevronRight aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
        </SidebarMenuAction>
      )}
      {hasChildren && (
        <SidebarMenuSub id={subtreeId} open={!isCollapsed}>
          {node.children.map((child) => (
            <OutlineNodeItem
              collapsed={collapsed}
              depth={depth + 1}
              key={child.heading.id}
              node={child}
              runtime={runtime}
              toggle={toggle}
            />
          ))}
        </SidebarMenuSub>
      )}
    </>
  );

  return depth === 0 ? (
    <SidebarMenuItem>{branch}</SidebarMenuItem>
  ) : (
    <SidebarMenuSubItem>{branch}</SidebarMenuSubItem>
  );
}

export function DocumentOutline({ runtime }: { runtime: DocumentTabsRuntime }) {
  const activeTabId = useStore(runtime.store, (state) => state.activeTabId);
  const activeTab = useStore(runtime.store, (state) =>
    state.tabs.find((tab) => tab.id === state.activeTabId),
  );
  const outline = useStore(runtime.navigation.store, (state) => state.outline);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const menuRef = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    setCollapsed(new Set());
  }, [activeTabId]);

  useEffect(() => {
    menuRef.current
      ?.querySelector<HTMLElement>('[aria-current="location"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [outline.activeId]);

  useEffect(() => {
    const ids = new Set(outline.headings.map((heading) => heading.id));
    setCollapsed((current) => {
      const next = new Set([...current].filter((id) => ids.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [outline.headings]);

  const tree = useMemo(() => buildDocumentOutline(outline.headings), [outline.headings]);
  if (!activeTabId) {
    return (
      <SidebarGroup aria-label="Document outline section" className="min-h-0 p-0">
        <p className="px-4 pt-1 pb-2 text-caption text-muted-foreground">No outline available</p>
      </SidebarGroup>
    );
  }
  const name = activeTab ? sourceName(activeTab.source) : 'Document';
  // A format that never publishes headings says so, instead of reading as a
  // document whose outline has not arrived yet.
  const outlines =
    activeTab === undefined ||
    documentViewerEntry(documentViewerFormat(activeTab.source.path)).outline;
  const outlineSummary = outline.available
    ? `${outline.headings.length} ${outline.headings.length === 1 ? 'heading' : 'headings'}`
    : outlines
      ? 'unavailable'
      : 'not available for this file type';

  const toggle = (id: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <SidebarGroup aria-label="Document outline section" className="min-h-0 p-0">
      <SidebarGroupLabel
        aria-label={`${name} outline, ${outlineSummary}`}
        className="mx-2 h-7 w-auto gap-1.5 px-2 text-caption"
      >
        <FileText aria-hidden="true" className="size-3.5 shrink-0" />
        <span className="min-w-0 truncate" title={name}>
          {name}
        </span>
        {outline.available && (
          <span
            aria-hidden="true"
            className="ml-auto text-[10px] text-muted-foreground tabular-nums"
          >
            {outline.headings.length}
          </span>
        )}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        {!outline.available ? (
          <p className="px-4 pt-1 pb-2 text-caption leading-relaxed text-muted-foreground">
            No outline available for this document
          </p>
        ) : tree.length === 0 ? (
          <p className="px-4 pt-1 pb-2 text-caption text-muted-foreground">
            No headings in this document
          </p>
        ) : (
          <nav aria-label="Document outline" className="px-2 pb-2">
            <SidebarMenu ref={menuRef} size="compact">
              {tree.map((node) => (
                <OutlineNodeItem
                  collapsed={collapsed}
                  depth={0}
                  key={node.heading.id}
                  node={node}
                  runtime={runtime}
                  toggle={toggle}
                />
              ))}
            </SidebarMenu>
          </nav>
        )}
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
