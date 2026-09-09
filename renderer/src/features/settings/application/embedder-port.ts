import type {
  EmbedderKeySave,
  EmbedderProvider,
  EmbedderState,
  HostedAccount,
  HostedSignIn,
  HostedSignInStatus,
} from '@/features/settings/domain/embedder';
import {
  featureErrorClass,
  type FeatureError,
  type FeatureFailureKind,
} from '@/shared/domain/feature-error';

/** AI Index source configuration. Credentials pass straight through to the
 *  server and are never retained here. */
export interface EmbedderPort {
  load(signal: AbortSignal): Promise<EmbedderState>;
  refreshAccount(signal: AbortSignal): Promise<HostedAccount>;
  removeKey(signal: AbortSignal): Promise<EmbedderState>;
  saveKey(provider: EmbedderProvider, key: string, signal: AbortSignal): Promise<EmbedderKeySave>;
  selectProvider(provider: EmbedderProvider, signal: AbortSignal): Promise<EmbedderState>;
  signInStatus(flowId: string, signal: AbortSignal): Promise<HostedSignInStatus>;
  signOut(signal: AbortSignal): Promise<void>;
  startSignIn(signal: AbortSignal): Promise<HostedSignIn>;
  useAccount(signal: AbortSignal): Promise<HostedAccount>;
}

export type EmbedderFailureKind = FeatureFailureKind<'rejected'>;

export type EmbedderError = FeatureError<'rejected'>;
export const EmbedderError = featureErrorClass<'rejected'>('EmbedderError');
