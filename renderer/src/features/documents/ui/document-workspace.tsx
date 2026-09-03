import { useEffect, useState } from 'react';

import type { DocumentSourceApi } from '@/features/documents/application/ports';
import type { DocumentTabsRuntime } from '@/features/documents/application/tabs-runtime';
import { documentTextFormat, sourceName } from '@/features/documents/domain/document';
import { retainMarkdownTabIds } from '@/features/documents/domain/markdown';
import { useDocumentTabs } from '@/features/documents/hooks/use-document-tabs';

import { DocumentSource } from './document-source';

export interface DocumentWorkspaceProps {
  api: DocumentSourceApi;
  runtime: DocumentTabsRuntime;
}

export function DocumentWorkspace({ api, runtime }: DocumentWorkspaceProps) {
  const { activeTab, activeTabId, tabs } = useDocumentTabs(runtime);
  const [retention, setRetention] = useState<{ ids: string[]; runtime: DocumentTabsRuntime }>(
    () => ({
      ids: [],
      runtime,
    }),
  );
  const retainedMarkdownIds = retainMarkdownTabIds(
    retention.runtime === runtime ? retention.ids : [],
    tabs,
    activeTabId,
  );
  useEffect(() => {
    setRetention((current) => {
      const ids = retainMarkdownTabIds(
        current.runtime === runtime ? current.ids : [],
        tabs,
        activeTabId,
      );
      if (
        current.runtime === runtime &&
        current.ids.length === ids.length &&
        current.ids.every((id, index) => id === ids[index])
      ) {
        return current;
      }
      return { ids, runtime };
    });
  }, [activeTabId, runtime, tabs]);
  if (tabs.length === 0) return null;
  const activeIsRetainedMarkdown = activeTab ? retainedMarkdownIds.includes(activeTab.id) : false;

  const renderDocument = (tabId: string, hidden: boolean) => {
    const tab = tabs.find((candidate) => candidate.id === tabId);
    const document = runtime.getDocument(tabId);
    if (!tab || !document) return null;
    return (
      <div
        aria-label={`${sourceName(tab.source)} document`}
        className={hidden ? 'hidden' : 'flex min-h-0 flex-1 flex-col'}
        hidden={hidden}
        key={tab.id}
        role="region"
      >
        <DocumentSource active={!hidden} api={api} runtime={document} />
      </div>
    );
  };

  return (
    <section aria-label="Document workspace" className="flex h-full min-h-0 flex-col">
      {retainedMarkdownIds.map((tabId) => renderDocument(tabId, tabId !== activeTabId))}
      {activeTab &&
        documentTextFormat(activeTab.source.path) !== 'md' &&
        !activeIsRetainedMarkdown &&
        renderDocument(activeTab.id, false)}
    </section>
  );
}
