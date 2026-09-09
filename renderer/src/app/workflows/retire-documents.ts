import type { DocumentTabsRuntime } from '@/features/documents/public';
import {
  treePathWithin,
  type WorkspaceEntry,
  type WorkspaceRuntime,
} from '@/features/workspace/public';
import type { SourceReference } from '@/shared/domain/source-reference';

/**
 * Settles every open document under an entry that is about to be renamed
 * or deleted: each is saved and closed through the tabs runtime, so a
 * dirty draft reaches disk before the entry moves and no tab keeps pointing
 * at a path that no longer exists. Answers the retired sources, so a rename
 * can reopen them at their new paths, or null when a save failed and the
 * entry must stay where it is.
 */
export async function retireDocuments(
  workspace: WorkspaceRuntime,
  documents: DocumentTabsRuntime,
  entry: WorkspaceEntry,
): Promise<SourceReference[] | null> {
  const folderPath = workspace.scope.folder.path;
  if (
    documents.scope.folderPath !== folderPath ||
    documents.scope.generation !== workspace.scope.generation
  ) {
    return [];
  }
  const affected = documents.store
    .getState()
    .tabs.filter(
      (tab) => tab.source.folderPath === folderPath && treePathWithin(tab.source.path, entry.path),
    );
  const retired: SourceReference[] = [];
  for (const tab of affected) {
    if (!(await documents.close(tab.id))) return null;
    retired.push(tab.source);
  }
  return retired;
}
