import {
  Circle,
  FileAudio,
  FileCode2,
  FileImage,
  FileText,
  FileType2,
  FileVideo,
  X,
} from 'lucide-react';
import { useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { useStore } from 'zustand';

import { TabItem, Tabs, TabsList } from '@/components/ui/tabs';
import type { DocumentRuntime } from '@/features/documents/application/document-runtime';
import type { DocumentTabsRuntime } from '@/features/documents/application/tabs-runtime';
import { sourceName } from '@/features/documents/domain/document';
import { documentViewerFormat } from '@/features/documents/domain/document-format';
import { mediaKind } from '@/features/documents/domain/media';
import { useDocumentTabs } from '@/features/documents/hooks/use-document-tabs';
import type { IconComponentProps } from '@/lib/icon-context';
import { cn } from '@/lib/utils';
import type { SourceReference } from '@/shared/domain/source-reference';

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

function DocumentTab({
  closeWithDelete,
  document,
  onClose,
  register,
  source,
  value,
  _index = 0,
}: {
  closeWithDelete: (event: KeyboardEvent<HTMLButtonElement>, tabId: string) => void;
  document: DocumentRuntime;
  onClose: (tabId: string) => void;
  register: (tabId: string, element: HTMLButtonElement | null) => void;
  source: SourceReference;
  value: string;
  /** @internal Assigned by TabsList. */
  _index?: number;
}) {
  const dirty = useStore(document.store, (state) => state.editor?.dirty ?? false);
  const name = sourceName(source);
  const format = documentViewerFormat(source.path);
  const icon =
    format === 'media'
      ? mediaKind(source.path) === 'video'
        ? FileVideo
        : FileAudio
      : format === 'image'
        ? FileImage
        : format === 'pdf'
          ? FileType2
          : format === 'html'
            ? FileCode2
            : FileText;

  return (
    <TabItem
      aria-keyshortcuts="Delete"
      aria-label={dirty ? `${name}, unsaved changes` : name}
      data-document-dirty={dirty || undefined}
      icon={icon}
      label={name}
      onKeyDown={(event) => closeWithDelete(event, value)}
      onTrailingClick={() => onClose(value)}
      ref={(element) => register(value, element)}
      title={`${source.folderPath}/${source.path}${dirty ? ' — Unsaved changes' : ''}`}
      trailingIcon={dirty ? UnsavedIndicator : X}
      value={value}
      _index={_index}
    />
  );
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
                closeWithDelete={closeWithDelete}
                document={document}
                key={tab.id}
                onClose={close}
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
