import type { PreparationFailure } from '../api';
import type { State } from './state';

export interface FileReadiness {
  preparationFailure: PreparationFailure | undefined;
}

export function preparationFailureMatchesTarget(failurePath: string, target: string): boolean {
  if (failurePath === target) return true;
  const slash = target.lastIndexOf('/');
  const dir = slash >= 0 ? target.slice(0, slash + 1) : '';
  const base = slash >= 0 ? target.slice(slash + 1) : target;
  return failurePath === `${dir}.${base}.md`;
}

export function getPreparationFailure(s: State, path: string): PreparationFailure | undefined {
  return s.preparationFailures.find((f) => preparationFailureMatchesTarget(f.path, path));
}

export function getFileReadiness(s: State, path: string): FileReadiness {
  return {
    preparationFailure: getPreparationFailure(s, path),
  };
}
