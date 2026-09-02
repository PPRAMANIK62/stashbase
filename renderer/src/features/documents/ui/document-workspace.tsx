import type { DocumentSourceApi } from '@/features/documents/application/ports';
import type { DocumentTabsRuntime } from '@/features/documents/application/tabs-runtime';
import { sourceName } from '@/features/documents/domain/document';
import { useDocumentTabs } from '@/features/documents/hooks/use-document-tabs';

import { DocumentSource } from './document-source';

export interface DocumentWorkspaceProps {
  api: DocumentSourceApi;
  runtime: DocumentTabsRuntime;
}

export function DocumentWorkspace({ api, runtime }: DocumentWorkspaceProps) {
  const { activeTab, tabs } = useDocumentTabs(runtime);
  if (tabs.length === 0) return null;
  const activeDocument = activeTab ? runtime.getDocument(activeTab.id) : null;

  return (
    <section aria-label="Document workspace" className="flex h-full min-h-0 flex-col">
      {activeTab && activeDocument && (
        <div
          aria-label={`${sourceName(activeTab.source)} document`}
          className="flex min-h-0 flex-1 flex-col"
          role="region"
        >
          <DocumentSource api={api} runtime={activeDocument} />
        </div>
      )}
    </section>
  );
}
