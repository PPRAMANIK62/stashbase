/**
 * The search-by-meaning source as the renderer reasons about it: whether a key
 * the reader brought is answering embeddings.
 *
 * These are the feature's own types, not the wire's. Absence is a `null`
 * field rather than a missing key, so a view never has to tell "the server
 * omitted it" apart from "there is none"; `infrastructure/embedder-api.ts`
 * owns the translation from the transport shapes.
 */

export type EmbedderProvider = 'openai' | 'openrouter';

/** Every source the server may report. */
export type EmbeddingSource = EmbedderProvider;

/** The providers a reader may choose between, in offer order. */
export const EMBEDDER_PROVIDERS: readonly EmbedderProvider[] = ['openai', 'openrouter'];

export const EMBEDDER_PROVIDER_LABELS: Record<EmbedderProvider, string> = {
  openai: 'OpenAI',
  openrouter: 'OpenRouter',
};

export interface EmbedderState {
  readonly authorized: boolean;
  readonly hasKey: boolean;
  readonly model: string;
  readonly provider: EmbedderProvider;
  readonly source: EmbeddingSource;
}

/** A stored key answers with the one thing the reader still needs to see:
 *  whether StashBase could verify it before saving. */
export interface EmbedderKeySave {
  readonly warning: string | null;
}

/** The source answering embeddings, or `null` while nothing is authorized. */
export function activeEmbeddingSource(state: EmbedderState): EmbeddingSource | null {
  return state.authorized ? state.source : null;
}

/** Whether the reader's own key is what answers embeddings right now, which
 *  is the one state in which search by meaning exists for this renderer. */
export function keyIsActive(state: EmbedderState): boolean {
  return state.hasKey && activeEmbeddingSource(state) === state.provider;
}

/** What the current source means for search, said once under the group. */
export function describeEmbedderSource(state: EmbedderState): string {
  if (keyIsActive(state)) {
    return `Meaning-based search and indexing use your ${EMBEDDER_PROVIDER_LABELS[state.provider]} key.`;
  }
  return 'Searching by meaning isn’t set up. Add a key to turn it on. Keyword search keeps working.';
}
