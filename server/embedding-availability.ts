import { isEmbeddingConfigured, type EmbeddingSource } from './app-config.ts';

export type EmbeddingUnavailableReason = 'embedding-source-required';

export type EmbeddingAvailability =
  | { configured: false; available: false; reason: 'embedding-source-required' }
  | { configured: true; available: true };

/** Process-wide semantic-work gate for the active BYOK provider. */
export function embeddingAvailability(): EmbeddingAvailability {
  if (!isEmbeddingConfigured()) {
    return { configured: false, available: false, reason: 'embedding-source-required' };
  }
  return { configured: true, available: true };
}

export function isEmbeddingAvailable(): boolean {
  return embeddingAvailability().available;
}

export function shouldReconcileAfterEmbeddingSourceChange(
  previous: EmbeddingSource,
  next: EmbeddingSource,
  previouslyAvailable: boolean,
): boolean {
  return previous !== next || !previouslyAvailable;
}
