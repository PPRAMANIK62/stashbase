import { FileText, X } from 'lucide-react';
import { useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';

import { TabItem, Tabs, TabsList } from '@/components/ui/tabs';
import type { DocumentTabsRuntime } from '@/features/documents/application/tabs-runtime';
import { sourceName } from '@/features/documents/domain/document';
import { useDocumentTabs } from '@/features/documents/hooks/use-document-tabs';
import { cn } from '@/lib/utils';

export interface DocumentTabsProps {
  className?: string;
  emptyContent?: ReactNode;
  runtime: DocumentTabsRuntime;
}

export function DocumentTabs({ className, emptyContent = null, runtime }: DocumentTabsProps) {
  const { activate, activeTabId, close, tabs } = useDocumentTabs(runtime);
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

  const closeWithDelete = (event: KeyboardEvent<HTMLButtonElement>, tabId: string) => {
    if (event.key !== 'Delete') return;
    event.preventDefault();
    focusAfterClose.current = true;
    close(tabId);
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
            const name = sourceName(tab.source);
            return (
              <TabItem
                aria-keyshortcuts="Delete"
                icon={FileText}
                key={tab.id}
                label={name}
                onKeyDown={(event) => closeWithDelete(event, tab.id)}
                onTrailingClick={() => close(tab.id)}
                ref={(element) => {
                  if (element) tabElements.current.set(tab.id, element);
                  else tabElements.current.delete(tab.id);
                }}
                title={`${tab.source.folderPath}/${tab.source.path}`}
                trailingIcon={X}
                value={tab.id}
              />
            );
          })}
        </TabsList>
      </Tabs>
    </div>
  );
}
