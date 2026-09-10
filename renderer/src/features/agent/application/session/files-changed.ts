/** What the shell is told after an Agent write settles. A change is reported
 *  against the scope the work was observed under, not whichever scope the
 *  session happens to hold later, so a folder switch cannot re-attribute a
 *  completed write to the folder the user just opened. */
import { changedSource } from '@/features/agent/domain/file-change';
import type { AgentScope } from '@/features/agent/domain/session';
import type { SourceReference } from '@/shared/domain/source-reference';

/** Files a settled tool or native diff left changed under one scope. */
export interface AgentFilesChanged {
  scope: AgentScope;
  /** Every path as the runtime named it. */
  paths: string[];
  /** The ones that resolve to a source inside the scoped folder. */
  sources: SourceReference[];
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
