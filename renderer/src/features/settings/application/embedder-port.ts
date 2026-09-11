import type {
  EmbedderKeySave,
  EmbedderProvider,
  EmbedderState,
} from '@/features/settings/domain/embedder';
import {
  featureErrorClass,
  type FeatureError,
  type FeatureFailureKind,
} from '@/shared/domain/feature-error';

/** Search-by-meaning key configuration. The key passes straight through to
 *  the server and is never retained here. */
export interface EmbedderPort {
  load(signal: AbortSignal): Promise<EmbedderState>;
  removeKey(signal: AbortSignal): Promise<EmbedderState>;
  saveKey(provider: EmbedderProvider, key: string, signal: AbortSignal): Promise<EmbedderKeySave>;
}

export type EmbedderFailureKind = FeatureFailureKind<'rejected'>;

export type EmbedderError = FeatureError<'rejected'>;
export const EmbedderError = featureErrorClass<'rejected'>('EmbedderError');
