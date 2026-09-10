import { useMemo } from 'react';

import type { AgentScope, AgentScopeEnvironment, AgentScopeOutline } from '@/features/agent/public';
import { useOpenDocumentSources, type DocumentTabsRuntime } from '@/features/documents/public';
import { sourceReadiness } from '@/features/preparation/public';
import type { FolderIndexStatus } from '@/features/preparation/public';
import type { WorkspaceListing } from '@/features/workspace/public';

export interface AgentEnvironment {
  /** What the Agent may bind context against, or null while the folder's
   *  listing is unknown. */
  environment: AgentScopeEnvironment | null;
  /** The folder's top level, which seeds an empty chat's starter prompts. */
  outline: AgentScopeOutline | null;
  /** What a new chat is scoped to: the selected folder, or the library when
   *  none is selected. */
  scope: AgentScope;
}

/**
 * The one snapshot of the open folder that the Agent feature is allowed to see.
 *
 * The Agent validates bound context against the folder in front of the user,
 * and it has to do that without importing workspace or preparation state. So
 * the shell publishes a projection instead: the listing, per-source readiness
 * for anything not already current, the conversion versions, and the paths of
 * the documents open beside the chat. Everything here is derived — the Agent
 * never gets a handle it could use to change what it is looking at.
 *
 * Both halves are memoised because the runtime is told about a new environment
 * by identity; an equal-but-fresh object would republish the same folder on
 * every render.
 */
export function useAgentEnvironment(
  listing: WorkspaceListing | undefined,
  status: FolderIndexStatus | null,
  documents: DocumentTabsRuntime | null,
  folderPath: string | null,
  selectedFolderPath: string | null,
): AgentEnvironment {
  const openSources = useOpenDocumentSources(documents);

  // The selected folder, not the mounted workspace: a chat is scoped the
  // moment the reader picks a folder, before its workspace has settled.
  const scope = useMemo<AgentScope>(
    () => (selectedFolderPath ? { kind: 'folder', path: selectedFolderPath } : { kind: 'library' }),
    [selectedFolderPath],
  );

  const outline = useMemo<AgentScopeOutline | null>(() => {
    if (!listing) return null;
    const topLevel = (path: string) => !path.includes('/');
    return {
      files: listing.files.map((file) => file.path).filter(topLevel),
      folders: listing.folders.map((folder) => folder.path).filter(topLevel),
    };
  }, [listing]);

  const environment = useMemo<AgentScopeEnvironment | null>(() => {
    if (!listing || !folderPath) return null;
    const readiness: Record<string, AgentScopeEnvironment['readiness'][string]> = {};
    if (status) {
      for (const file of listing.files) {
        const kind = sourceReadiness(status, file.path).kind;
        if (kind !== 'current') readiness[file.path] = kind;
      }
    }
    return {
      folderPath,
      listing: {
        files: listing.files.map((file) => ({ format: file.format, path: file.path })),
        folders: listing.folders
          .filter((folder) => folder.kind === 'normal')
          .map((folder) => folder.path),
      },
      openPaths: openSources
        .filter((source) => source.folderPath === folderPath)
        .map((source) => source.path),
      readiness,
      versions: status?.conversionVersions ?? {},
    };
  }, [folderPath, listing, openSources, status]);

  return useMemo(() => ({ environment, outline, scope }), [environment, outline, scope]);
}
