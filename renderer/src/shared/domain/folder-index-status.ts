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

/** The daemon's standing warning about one folder's index. `sentence` is
 *  written by the daemon for the reader — it names the exact piece that is
 *  missing, which no fixed line here could — so it is carried as a sentence
 *  rather than as an error's message. */
interface SemanticIndexWarning {
  readonly at: string;
  readonly sentence: string;
}

/** What an unresolved AI Index build would cost, for the two states that ask
 *  the reader to decide about it. */
interface SemanticIndexWorkload {
  readonly estimatedBytes: number | null;
  /** Visible sources the build would have to embed. */
  readonly files: number;
}

/** One folder's AI Index state, as one variant per observable state carrying
 *  exactly the facts that state has. A state with nothing to say carries
 *  nothing, so no reader can consult a flag beside the state it came from. */
export type SemanticIndexStatus =
  | { readonly state: 'awaiting-decision'; readonly workload: SemanticIndexWorkload }
  | { readonly state: 'failed' }
  /** `partial` marks an index that already answers while the rest builds. */
  | { readonly partial: boolean; readonly remaining: number; readonly state: 'indexing' }
  | {
      readonly partial: boolean;
      readonly state: 'paused';
      readonly workload: SemanticIndexWorkload;
    }
  | { readonly state: 'not-set-up' }
  | { readonly state: 'quota-exhausted' }
  | { readonly state: 'ready' };

export interface FolderIndexStatus {
  readonly blockedConversions: readonly string[];
  readonly conversionProgress: Readonly<Record<string, PreparationProgress>>;
  readonly conversionRevision: number;
  readonly conversionVersions: Readonly<Record<string, number>>;
  readonly folderPath: string;
  readonly indexed: number;
  /** Whether the visible sources' embedding work has come to rest. It paces
   *  polling beside the conversion queues; it is not a presentation state. */
  readonly indexSettled: boolean;
  /** The daemon's standing index warning, whatever the semantic state. */
  readonly indexWarning: SemanticIndexWarning | null;
  readonly pendingConversions: readonly string[];
  readonly preparationFailures: readonly PreparationFailure[];
  readonly semantic: SemanticIndexStatus;
  readonly total: number;
  readonly treeVersion: number;
}
