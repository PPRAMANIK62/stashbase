/**
 * The open documents' tab strip. A preview tab wears its name in italics and
 * says so in its label; a double click, or Enter on the focused tab, keeps
 * it. Delete closes the focused tab, and every tab is a drag source for its
 * file.
 */
import { Circle, X } from 'lucide-react';
import { useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { useStore } from 'zustand';

import { TabItem, Tabs, TabsList } from '@/components/ui/tabs';
import type { DocumentRuntime } from '@/features/documents/application/document-runtime';
import type { DocumentTabsRuntime } from '@/features/documents/application/tabs-runtime';
import { isDocumentDirty, sourceName } from '@/features/documents/domain/document';
import { documentViewerFormat } from '@/features/documents/domain/document-format';
import { useDocumentTabs } from '@/features/documents/hooks/use-document-tabs';
import { documentViewerEntry } from '@/features/documents/ui/source/registry';
import type { IconComponentProps } from '@/lib/icon-context';
import { cn } from '@/lib/utils';
import type { SourceReference } from '@/shared/domain/source-reference';
import { writeSourceDrag } from '@/shared/utils/source-drag';

export interface DocumentTabsProps {
  className?: string;
  emptyContent?: ReactNode;
  runtime: DocumentTabsRuntime;
}

function UnsavedIndicator({ className, ...props }: IconComponentProps) {
  return (
    <Circle
      {...props}
      className={cn('fill-current stroke-none', className)}
      data-unsaved-indicator=""
      size={8}
    />
  );
}

function tabLabel(name: string, dirty: boolean, preview: boolean): string {
  if (dirty) return `${name}, unsaved changes`;
  return preview ? `${name}, preview` : name;
}

function DocumentTab({
  document,
  onClose,
  onKeep,
  onKeyDown,
  preview,
  register,
  source,
  value,
}: {
  document: DocumentRuntime;
  onClose: (tabId: string) => void;
  onKeep: (tabId: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>, tabId: string) => void;
  preview: boolean;
  register: (tabId: string, element: HTMLButtonElement | null) => void;
  source: SourceReference;
  value: string;
}) {
  const dirty = useStore(document.store, (state) =>
    state.editor ? isDocumentDirty(state.editor) : false,
  );
  const name = sourceName(source);
  const icon = documentViewerEntry(documentViewerFormat(source.path)).icon(source.path);

  return (
    <TabItem
      aria-keyshortcuts={preview ? 'Delete Enter' : 'Delete'}
      aria-label={tabLabel(name, dirty, preview)}
      // Italic is inherited by the label, so the tab says "only looking"
      // without the strip's label primitive knowing about previews.
      className={preview ? 'italic' : undefined}
      data-document-dirty={dirty || undefined}
      data-document-preview={preview || undefined}
      draggable
      icon={icon}
      label={name}
      // A double click is the reader asking for the tab to stay; a kept tab
      // has nothing further to give.
      onDoubleClick={preview ? () => onKeep(value) : undefined}
      // The open document is a source the user can hand to another surface —
      // dropping a tab on the Agent composer binds it as explicit context.
      onDragStart={(event) => writeSourceDrag(event.dataTransfer, source)}
      onKeyDown={(event) => onKeyDown(event, value)}
      onTrailingClick={() => onClose(value)}
      ref={(element) => register(value, element)}
      title={`${source.folderPath}/${source.path}${dirty ? ' — Unsaved changes' : ''}`}
      trailingIcon={dirty ? UnsavedIndicator : X}
      value={value}
    />
  );
}

export function DocumentTabs({ className, emptyContent = null, runtime }: DocumentTabsProps) {
  const { activate, activeTabId, close, keep, tabs } = useDocumentTabs(runtime);
  const focusAfterClose = useRef(false);
  const tabElements = useRef(new Map<string, HTMLButtonElement>());

  useLayoutEffect(() => {
    if (!focusAfterClose.current || !activeTabId) return;
    focusAfterClose.current = false;
    tabElements.current.get(activeTabId)?.focus();
  }, [activeTabId]);

  useLayoutEffect(() => {
    if (!activeTabId) return;
    tabElements.current.get(activeTabId)?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [activeTabId]);

  if (tabs.length === 0) return emptyContent;

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, tabId: string) => {
    if (event.key === 'Delete') {
      event.preventDefault();
      focusAfterClose.current = true;
      close(tabId);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      keep(tabId);
    }
  };

  const registerTab = (tabId: string, element: HTMLButtonElement | null) => {
    if (element) tabElements.current.set(tabId, element);
    else tabElements.current.delete(tabId);
  };

  return (
    <div className={cn('flex min-w-0 items-center', className)}>
      <Tabs
        className="min-w-0 flex-1 overflow-hidden"
        onValueChange={activate}
        value={activeTabId ?? ''}
      >
        <TabsList aria-label="Open documents" className="scrollbar-hide max-w-full overflow-x-auto">
          {tabs.map((tab) => {
            const document = runtime.getDocument(tab.id);
            if (!document) return null;
            return (
              <DocumentTab
                document={document}
                key={tab.id}
                onClose={close}
                onKeep={keep}
                onKeyDown={onTabKeyDown}
                preview={tab.preview}
                register={registerTab}
                source={tab.source}
                value={tab.id}
              />
            );
          })}
        </TabsList>
      </Tabs>
    </div>
  );
}
