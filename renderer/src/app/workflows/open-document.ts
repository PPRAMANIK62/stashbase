import type {
  DocumentRuntime,
  DocumentSearchTarget,
  DocumentTabsRuntime,
} from '@/features/documents/public';
import type { WorkspaceRuntime } from '@/features/workspace/public';
import type { SourceReference } from '@/shared/domain/source-reference';

export async function openDocument(
  workspace: WorkspaceRuntime,
  documents: DocumentTabsRuntime,
  source: SourceReference,
  options?: { anchor?: string; search?: DocumentSearchTarget },
): Promise<DocumentRuntime | null> {
  const workspaceOperation = workspace.capture();
  const documentScope = documents.capture();
  let opening: Promise<DocumentRuntime | null> | null = null;

  if (
    documentScope.scope.folderPath !== workspaceOperation.scope.folder.path ||
    documentScope.scope.generation !== workspaceOperation.scope.generation
  ) {
    return null;
  }

  workspace.accept(workspaceOperation, () => {
    documents.accept(documentScope, () => {
      opening = documents.open(source, options);
    });
  });

  return opening;
}
