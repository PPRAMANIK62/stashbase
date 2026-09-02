import { FileText } from 'lucide-react';

import type { DocumentTabsRuntime } from '@/features/documents/application/tabs-runtime';
import { sourceName } from '@/features/documents/domain/document';
import { useDocumentTabs } from '@/features/documents/hooks/use-document-tabs';

export interface DocumentWorkspaceProps {
  runtime: DocumentTabsRuntime;
}

export function DocumentWorkspace({ runtime }: DocumentWorkspaceProps) {
  const { activeTab, tabs } = useDocumentTabs(runtime);
  if (tabs.length === 0) return null;

  return (
    <section aria-label="Document workspace" className="flex h-full min-h-0 flex-col">
      {activeTab && (
        <div
          aria-label={`${sourceName(activeTab.source)} document`}
          className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center"
          role="region"
        >
          <FileText aria-hidden="true" className="size-8 text-muted-foreground" />
          <div className="max-w-full min-w-0">
            <p className="truncate text-body font-medium">{sourceName(activeTab.source)}</p>
            <p className="mt-1 truncate text-caption text-muted-foreground">
              {activeTab.source.path}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
