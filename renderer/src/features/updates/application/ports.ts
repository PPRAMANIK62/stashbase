import type { UpdateState } from '@/features/updates/domain/update-status';

/** Why an update command did not happen. `unauthorized` is this window not
 *  being allowed to manage updates at all; `unavailable` is StashBase not
 *  being able to reach the updater, which is also how a malformed answer and
 *  a rejected call read, because none of the three is the reader's to fix. */
export type UpdateRefusal = 'unauthorized' | 'unavailable';

/** Every command answers the same way: the state main now stands behind, or
 *  the reason it would not act. Nothing throws. */
export type UpdateResult =
  | { readonly ok: true; readonly state: UpdateState }
  | { readonly kind: UpdateRefusal; readonly ok: false };

export interface UpdatesPort {
  check(): Promise<UpdateResult>;
  openReleasePage(): Promise<UpdateResult>;
  read(): Promise<UpdateResult>;
  runPrimaryAction(): Promise<UpdateResult>;
  setAutoCheck(enabled: boolean): Promise<UpdateResult>;
  /** Main pushes on every transition of its own. Returns the unsubscribe. */
  subscribe(onState: (state: UpdateState) => void): () => void;
}
