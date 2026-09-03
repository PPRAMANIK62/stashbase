import type { DocumentRuntime, DocumentTabsRuntime } from '@/features/documents/public';
import type { WorkspaceRuntime } from '@/features/workspace/public';
import type { SourceReference } from '@/shared/domain/source-reference';

export async function openDocument(
  workspace: WorkspaceRuntime,
  documents: DocumentTabsRuntime,
  source: SourceReference,
  options?: { anchor?: string },
): Promise<DocumentRuntime | null> {
  const workspaceScope = workspace.scope;
  const documentScope = documents.scope;
  let opening: Promise<DocumentRuntime | null> | null = null;

  if (
    documentScope.folderPath !== workspaceScope.folder.path ||
    documentScope.generation !== workspaceScope.generation
  ) {
    return null;
  }

  workspace.accept(workspaceScope, () => {
    documents.accept(documentScope, () => {
      opening = documents.open(source, options);
    });
  });

  return opening;
}
