/**
 * Whether to invite the reader to set up search by meaning.
 *
 * The invitation is one-time and application-wide, not per folder: it appears
 * at the first folder a reader activates and never again once answered, by
 * configuring a source or by declining. Decision 0019 fixes that model and its
 * durable home, the server's onboarding preferences, so a decline survives a
 * relaunch rather than depending on browser storage.
 *
 * The answered revision is stored rather than a boolean, so raising
 * `currentVersion` re-offers a materially changed invitation deliberately.
 */

export interface SearchSetupInvitationInput {
  /** The revision already answered, or null when never answered. */
  readonly answeredVersion: number | null;
  /** True once an embedding source is configured, false once known not to be,
   *  and null while the folder's readiness has not answered yet. Offering on a
   *  null would flash the invitation at a reader who is already set up. */
  readonly configured: boolean | null;
  /** The revision this build would offer. */
  readonly currentVersion: number;
  /** True once a folder is active. The invitation follows first activation, so
   *  a bare Library window never opens it. */
  readonly folderActive: boolean;
  /** False until the stored answer has loaded. Offering before it is known
   *  would show the invitation to someone who already declined it. */
  readonly loaded: boolean;
}

export type SearchSetupInvitation =
  | { readonly kind: 'offer'; readonly version: number }
  | { readonly kind: 'answered' }
  | { readonly kind: 'already-set-up' }
  | { readonly kind: 'no-folder' }
  | { readonly kind: 'unknown' };

export function searchSetupInvitation(input: SearchSetupInvitationInput): SearchSetupInvitation {
  if (!input.loaded || input.configured === null) return { kind: 'unknown' };
  if (input.configured) return { kind: 'already-set-up' };
  if (input.answeredVersion !== null && input.answeredVersion >= input.currentVersion) {
    return { kind: 'answered' };
  }
  if (!input.folderActive) return { kind: 'no-folder' };
  return { kind: 'offer', version: input.currentVersion };
}
