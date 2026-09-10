import type { DocumentTabsRuntime } from '@/features/documents/public';
import {
  treePathWithin,
  type WorkspaceEntry,
  type WorkspaceOperationScope,
  type WorkspaceRuntime,
} from '@/features/workspace/public';
import type { SourceReference } from '@/shared/domain/source-reference';

/**
 * Settles every open document under an entry that is about to be renamed or
 * deleted: each is saved and closed through the tabs runtime, so a dirty draft
 * reaches disk before the entry moves and no tab keeps pointing at a path that
 * no longer exists. Answers the retired sources, so a rename can reopen them at
 * their new paths, or null when a save failed and the entry must stay where it
 * is.
 *
 * Every close is an `await`, so the folder can be retired or rebound part way
 * through. The scope is captured once, before the first of them, and re-checked
 * after each: what is still open then is no longer this folder's to settle, and
 * the caller must not go on to move the entry.
 */
export async function retireDocuments(
  workspace: WorkspaceRuntime,
  documents: DocumentTabsRuntime,
  entry: WorkspaceEntry,
): Promise<SourceReference[] | null> {
  const captured = workspace.capture();
  const folderPath = captured.scope.folder.path;
  if (
    documents.scope.folderPath !== folderPath ||
    documents.scope.generation !== captured.scope.generation
  ) {
    return [];
  }
  const affected = documents
    .openSources()
    .filter(
      (source) => source.folderPath === folderPath && treePathWithin(source.path, entry.path),
    );
  const retired: SourceReference[] = [];
  for (const source of affected) {
    if (!(await documents.closeSource(source))) return null;
    if (!stillOpen(workspace, captured)) return null;
    retired.push(source);
  }
  return retired;
}

/** Whether the folder this retirement started in is still the open one. */
function stillOpen(workspace: WorkspaceRuntime, captured: WorkspaceOperationScope): boolean {
  return workspace.accept(captured, () => undefined);
}
