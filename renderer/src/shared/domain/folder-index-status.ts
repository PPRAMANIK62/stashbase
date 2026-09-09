/** The renderer's model of one folder's preparation and AI Index snapshot.
 *  It is explanatory state: derived artifacts and the daemon remain the
 *  completion truth. Paths are folder-relative visible source paths. */

export type PreparationProgress =
  | {
      readonly lane: 'light' | 'heavy';
      readonly phase: 'queued' | 'yielded';
      readonly tasksAhead: number;
    }
  | {
      readonly phase: 'extracting';
      readonly completedUnits?: number;
      readonly currentPage?: number;
      readonly totalUnits?: number;
    }
  | { readonly phase: 'indexing' };

export interface PreparationFailure {
  readonly attempts: number;
  readonly lastError: string;
  readonly path: string;
  readonly status: 'failed' | 'cancelled';
}

export type SemanticIndexingState =
  | 'disabled'
  | 'quota-exhausted'
  | 'partial-quota-exhausted'
  | 'awaiting-decision'
  | 'paused'
  | 'partial-paused'
  | 'indexing'
  | 'partial-indexing'
  | 'ready'
  | 'failed';

export interface SemanticIndexStatus {
  readonly available: boolean;
  readonly disabledReason: string | null;
  readonly enabled: boolean;
  readonly estimatedBytes: number | null;
  readonly indexReady: boolean;
  /** Visible sources still waiting to be embedded; empty when unavailable. */
  readonly pending: readonly string[];
  readonly settled: boolean;
  readonly sourceCount: number | null;
  readonly state: SemanticIndexingState;
  readonly warning: { readonly at: string; readonly message: string } | null;
}

export interface FolderIndexStatus {
  readonly blockedConversions: readonly string[];
  readonly conversionProgress: Readonly<Record<string, PreparationProgress>>;
  readonly conversionRevision: number;
  readonly conversionVersions: Readonly<Record<string, number>>;
  readonly folderPath: string;
  readonly indexed: number;
  readonly pendingConversions: readonly string[];
  readonly preparationFailures: readonly PreparationFailure[];
  readonly semantic: SemanticIndexStatus;
  readonly total: number;
  readonly treeVersion: number;
}
