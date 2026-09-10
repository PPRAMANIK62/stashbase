import { useCallback } from 'react';

import { openDocument } from '@/app/workflows/open-document';
import { retireDocuments } from '@/app/workflows/retire-documents';
import type { DocumentNavigationTarget, DocumentTabsRuntime } from '@/features/documents/public';
import type { SearchNavigationIntent } from '@/features/retrieval/public';
import {
  useLibraryLifecycle,
  type WorkspaceAdapters,
  type WorkspaceEntry,
  type WorkspaceRuntime,
  type WorkspaceScope,
} from '@/features/workspace/public';
import type { SourceReference } from '@/shared/domain/source-reference';

export interface DocumentSources {
  /** The host's refusal to follow this window's folder, or null while it
   *  agrees. A window the host disagrees with cannot reconcile anything, so
   *  the shell says so rather than failing quietly. */
  hostFailure: string | null;
  /** Follows a link inside a document, landing on its anchor when it has one. */
  navigate(target: DocumentNavigationTarget): void;
  /** Opens the document behind a search hit and lands on the match. Answers
   *  whether the document opened. */
  navigateToMatch(intent: SearchNavigationIntent): Promise<boolean>;
  open(source: SourceReference): void;
  /** Reconciles a scope this window lost with the library the host reports. */
  recoverLostScope(scope: WorkspaceScope): void;
  /** Settles the open documents under an entry before it is renamed or
   *  deleted. */
  retire(entry: WorkspaceEntry): Promise<SourceReference[] | null>;
  /** Flushes the open folder's unsaved documents; true when it is safe to
   *  leave the folder. */
  saveOpenFolder(): Promise<boolean>;
}

/**
 * The document workflows, bound to the workspace and tabs runtimes that are
 * live right now.
 *
 * Each workflow needs both runtimes and refuses to act without them, so the
 * binding is done once here instead of at every call site. The save barrier is
 * the reason this is not just a bag of callbacks: the library lifecycle has to
 * be able to stop a folder change until the folder's own documents have been
 * flushed, and only the folder that owns a document may answer for it.
 */
export function useDocumentSources(
  adapters: WorkspaceAdapters,
  workspace: WorkspaceRuntime | null,
  documents: DocumentTabsRuntime | null,
): DocumentSources {
  const saveDocumentsForFolder = useCallback(
    (folderPath: string) =>
      documents?.scope.folderPath === folderPath ? documents.flush() : Promise.resolve(true),
    [documents],
  );

  const libraryLifecycle = useLibraryLifecycle(
    adapters.library,
    adapters.lifecycle,
    workspace,
    saveDocumentsForFolder,
  );

  const open = useCallback(
    (source: SourceReference) => {
      if (workspace && documents) void openDocument(workspace, documents, source);
    },
    [documents, workspace],
  );

  const navigate = useCallback(
    (target: DocumentNavigationTarget) => {
      if (!workspace || !documents) return;
      void openDocument(
        workspace,
        documents,
        target.source,
        target.anchor === undefined ? undefined : { anchor: target.anchor },
      );
    },
    [documents, workspace],
  );

  const navigateToMatch = useCallback(
    async (intent: SearchNavigationIntent) => {
      if (!workspace || !documents) return false;
      const opened = await openDocument(workspace, documents, intent.source, {
        search: intent.target,
      });
      return opened !== null;
    },
    [documents, workspace],
  );

  const retire = useCallback(
    (entry: WorkspaceEntry) =>
      workspace && documents
        ? retireDocuments(workspace, documents, entry)
        : Promise.resolve<SourceReference[]>([]),
    [documents, workspace],
  );

  const saveOpenFolder = useCallback(
    () => (workspace ? saveDocumentsForFolder(workspace.scope.folder.path) : Promise.resolve(true)),
    [saveDocumentsForFolder, workspace],
  );

  return {
    hostFailure: libraryLifecycle.failure,
    navigate,
    navigateToMatch,
    open,
    recoverLostScope: libraryLifecycle.recoverLostScope,
    retire,
    saveOpenFolder,
  };
}
