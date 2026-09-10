import { useEffect, useState, type ReactNode } from 'react';

import type {
  DocumentAssetPort,
  DocumentSourcePort,
  DocxPreviewPort,
  GenericFilePreviewPort,
  MediaPort,
} from '@/features/documents/application/ports';
import type { DocumentTabsRuntime } from '@/features/documents/application/tabs-runtime';
import { sourceName } from '@/features/documents/domain/document';
import {
  documentTextFormat,
  documentViewerFormat,
} from '@/features/documents/domain/document-format';
import { retainMarkdownTabIds } from '@/features/documents/domain/markdown';
import { useDocumentTabs } from '@/features/documents/hooks/use-document-tabs';
import { DocumentSource } from '@/features/documents/ui/source/document';
import { documentViewerEntry } from '@/features/documents/ui/source/registry';
import type {
  DocumentNavigationTarget,
  DocumentViewerRegistry,
  PreparationSlotFormat,
  PreparedOnOpenFormat,
} from '@/features/documents/ui/source/viewer';
import type { SourceReference } from '@/shared/domain/source-reference';

import { DocumentFind } from './find';

const ignoreNavigation = () => undefined;
const rejectExternalNavigation = async () => false;

export interface DocumentWorkspaceProps {
  assetApi: DocumentAssetPort;
  docxPreviewApi: DocxPreviewPort;
  genericPreviewApi: GenericFilePreviewPort;
  mediaApi: MediaPort;
  onNavigate?: ((target: DocumentNavigationTarget) => void) | undefined;
  onOpenExternal?: ((href: string) => Promise<boolean>) | undefined;
  /** Fired once when a DOCX or media document mounts so preparation can be
   *  queued at interactive priority. Fire-and-forget. */
  onOpenPrepared?: ((source: SourceReference, format: PreparedOnOpenFormat) => void) | undefined;
  onReveal(source: SourceReference, signal: AbortSignal): Promise<void>;
  /** Composes a preparation status row above PDF, image, and DOCX viewers. */
  renderPreparation?:
    | ((source: SourceReference, format: PreparationSlotFormat) => ReactNode)
    | undefined;
  revealLabel: string;
  runtime: DocumentTabsRuntime;
  sourceApi: DocumentSourcePort;
  /** Overridable so a test can register a viewer of its own. */
  viewers?: DocumentViewerRegistry | undefined;
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
  viewers,
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
  // A format that never claims a find controller shows no find bar at all.
  const activeFindable = activeTab
    ? documentViewerEntry(documentViewerFormat(activeTab.source.path), viewers).find
    : false;

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
          viewers={viewers}
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
      {activeFindable && <DocumentFind runtime={runtime.navigation} />}
    </section>
  );
}
