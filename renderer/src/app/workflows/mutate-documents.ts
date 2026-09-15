import type { DocumentTabsRuntime } from '@/features/documents/public';
import {
  FilesError,
  type WorkspaceEntry,
  type WorkspaceRuntime,
} from '@/features/workspace/public';

/** Keep affected documents alive until the filesystem operation is confirmed. */
export async function mutateDocuments(
  workspace: WorkspaceRuntime,
  documents: DocumentTabsRuntime,
  entry: WorkspaceEntry,
  operation: () => Promise<string | null>,
): Promise<boolean> {
  const captured = workspace.capture();
  if (
    documents.scope.folderPath !== captured.scope.folder.path ||
    documents.scope.generation !== captured.scope.generation
  )
    return false;
  let failure: unknown;
  const completed = await documents.mutate(entry.path, async () => {
    if (!workspace.accept(captured, () => undefined))
      throw new Error('Project changed before the file operation.');
    try {
      return await operation();
    } catch (error) {
      if (!(error instanceof FilesError) || error.kind !== 'outcome-unknown') throw error;
      failure = error;
      return undefined;
    }
  });
  if (failure) throw failure;
  return completed;
}
