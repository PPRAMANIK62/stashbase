import {
  getEmbeddingSource,
  isEmbeddingConfigured,
  type EmbeddingSource,
} from './app-config.ts';
import { isHostedQuotaExhausted } from './hosted-account.ts';

export type EmbeddingUnavailableReason =
  | 'embedding-source-required'
  | 'hosted-quota-exhausted';

export type EmbeddingAvailability =
  | { configured: false; available: false; reason: 'embedding-source-required' }
  | { configured: true; available: false; reason: 'hosted-quota-exhausted' }
  | { configured: true; available: true };

/**
 * Process-wide semantic-work gate. Configuration answers whether the user has
 * selected a usable source; availability additionally stops every hosted
 * index/query entry point once the shared allowance reaches zero.
 */
export function embeddingAvailability(): EmbeddingAvailability {
  if (!isEmbeddingConfigured()) {
    return { configured: false, available: false, reason: 'embedding-source-required' };
  }
  if (getEmbeddingSource() === 'stashbase-account' && isHostedQuotaExhausted()) {
    return { configured: true, available: false, reason: 'hosted-quota-exhausted' };
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
