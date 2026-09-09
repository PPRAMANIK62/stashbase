import { useEffect, useState, type ReactNode } from 'react';

import type {
  DocumentAssetApi,
  DocumentSourceApi,
  DocxPreviewApi,
  GenericFilePreviewApi,
  MediaApi,
} from '@/features/documents/application/ports';
import type { DocumentTabsRuntime } from '@/features/documents/application/tabs-runtime';
import { sourceName } from '@/features/documents/domain/document';
import { documentTextFormat } from '@/features/documents/domain/document-format';
import { retainMarkdownTabIds } from '@/features/documents/domain/markdown';
import { useDocumentTabs } from '@/features/documents/hooks/use-document-tabs';
import {
  DocumentSource,
  type PreparationSlotFormat,
  type PreparedOnOpenFormat,
} from '@/features/documents/ui/source/document';
import type { SourceReference } from '@/shared/domain/source-reference';

import { DocumentFind } from './find';

const ignoreNavigation = () => undefined;
const rejectExternalNavigation = async () => false;

export interface DocumentWorkspaceProps {
  assetApi: DocumentAssetApi;
  docxPreviewApi: DocxPreviewApi;
  genericPreviewApi: GenericFilePreviewApi;
  mediaApi: MediaApi;
  onNavigate?(target: { anchor?: string; source: SourceReference }): void;
  onOpenExternal?(href: string): Promise<boolean>;
  /** Fired once when a DOCX or media document mounts so preparation can be
   *  queued at interactive priority. Fire-and-forget. */
  onOpenPrepared?(source: SourceReference, format: PreparedOnOpenFormat): void;
  onReveal(source: SourceReference, signal: AbortSignal): Promise<void>;
  /** Composes a preparation status row above PDF, image, and DOCX viewers. */
  renderPreparation?(source: SourceReference, format: PreparationSlotFormat): ReactNode;
  revealLabel: string;
  runtime: DocumentTabsRuntime;
  sourceApi: DocumentSourceApi;
}

export function DocumentWorkspace({
  assetApi,
  docxPreviewApi,
  genericPreviewApi,
  mediaApi,
  onNavigate = ignoreNavigation,
  onOpenExternal = rejectExternalNavigation,
  onOpenPrepared,
  onReveal,
  renderPreparation,
  revealLabel,
  runtime,
  sourceApi,
}: DocumentWorkspaceProps) {
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
        <DocumentSource
          active={!hidden}
          assetApi={assetApi}
          docxPreviewApi={docxPreviewApi}
          genericPreviewApi={genericPreviewApi}
          mediaApi={mediaApi}
          navigation={runtime.navigation}
          onNavigate={onNavigate}
          onOpenExternal={onOpenExternal}
          onOpenPrepared={onOpenPrepared}
          onReveal={onReveal}
          renderPreparation={renderPreparation}
          revealLabel={revealLabel}
          runtime={document}
          sourceApi={sourceApi}
        />
      </div>
    );
  };

  return (
    <section aria-label="Document workspace" className="relative flex h-full min-h-0 flex-col">
      {retainedMarkdownIds.map((tabId) => renderDocument(tabId, tabId !== activeTabId))}
      {activeTab &&
        documentTextFormat(activeTab.source.path) !== 'md' &&
        !activeIsRetainedMarkdown &&
        renderDocument(activeTab.id, false)}
      <DocumentFind runtime={runtime.navigation} />
    </section>
  );
}
