/** What the shell is told after an Agent write settles. A change is reported
 *  against the scope the work was observed under, not whichever scope the
 *  session happens to hold later, so a folder switch cannot re-attribute a
 *  completed write to the folder the user just opened. */
import { changedSource } from '@/features/agent/domain/file-change';
import type { AgentScope } from '@/features/agent/domain/session';
import type { SourceReference } from '@/shared/domain/source-reference';

/** Files a settled tool or native diff left changed under one scope, or a
 *  settled turn that may have changed files it never named. */
export interface AgentFilesChanged {
  scope: AgentScope;
  /** Every path as the runtime named it; empty when the turn wrote through
   *  a shell command or a subagent and named nothing. */
  paths: string[];
  /** The ones that resolve to a source inside the scoped folder. */
  sources: SourceReference[];
}

/** The notification for a turn that ran work the app could not see into
 *  under `scope`. No document is named, so none is reloaded, but the folder's
 *  listing and index may be behind the disk. */
export function folderMayHaveChanged(scope: AgentScope): AgentFilesChanged {
  return { paths: [], scope, sources: [] };
}

/** Builds the notification for `changed` under `scope`, or null when the
 *  write named no paths worth reporting. */
export function filesChanged(
  scope: AgentScope,
  changed: readonly string[],
): AgentFilesChanged | null {
  if (changed.length === 0) return null;
  const paths = [...new Set(changed)];
  return {
    paths,
    scope,
    sources: paths.flatMap((path) => changedSource(scope, path) ?? []),
  };
}
