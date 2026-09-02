import type { DocumentRuntime, DocumentTabsRuntime } from '@/features/documents/public';
import type { WorkspaceRuntime } from '@/features/workspace/public';
import type { SourceReference } from '@/shared/domain/source-reference';

export function openDocument(
  workspace: WorkspaceRuntime,
  documents: DocumentTabsRuntime,
  source: SourceReference,
): DocumentRuntime | null {
  const workspaceScope = workspace.scope;
  const documentScope = documents.scope;
  let opened: DocumentRuntime | null = null;

  if (
    documentScope.folderPath !== workspaceScope.folder.path ||
    documentScope.generation !== workspaceScope.generation
  ) {
    return null;
  }

  workspace.accept(workspaceScope, () => {
    documents.accept(documentScope, () => {
      opened = documents.open(source);
    });
  });

  return opened;
}
