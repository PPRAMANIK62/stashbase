/** The user-owned provider authorized to produce embeddings. */

export type EmbedderProvider = 'openai' | 'openrouter';

export type EmbeddingSource = EmbedderProvider;

/** What saving a provider key reports back. `hasKey` is literal `true`:
 *  the endpoint only answers on success, so a caller never has to check it. */
export interface ApiKeySaveResult {
  hasKey: true;
  /** Always true — saving a key activates it, so the endpoint only answers
   *  on an authorized state. Sent so a caller can apply the whole embedder
   *  state from this one response. */
  authorized: true;
  source: EmbeddingSource;
  provider: EmbedderProvider;
  model: string;
  /** True only when adding the first active embedding key and the server
   *  started a semantic backfill. Rotating a key keeps existing vectors
   *  valid and should not make files look pending. */
  backfillStarted?: boolean;
  /** Present when the key was saved but StashBase could not reach
   *  the provider to validate it at save time. Indexing/search will
   *  surface the real connectivity failure if it persists. */
  warning?: string;
}

/** Which embedding source is configured and whether it is usable now.
 *  `hasKey` and `authorized` differ: a stored key that is not the active
 *  source leaves the first true and the second false. */
export interface EmbedderState {
  provider: EmbedderProvider;
  hasKey: boolean;
  authorized: boolean;
  source: EmbeddingSource;
  model: string;
  /** Present only on a source-switch response when pending files should be
   * presented as backfill work immediately. */
  backfillStarted?: boolean;
}
