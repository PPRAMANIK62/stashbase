import type {
  EmbedderKeySaveResponseWire,
  EmbedderStateWire,
  HostedAccountStateWire,
  HostedOAuthStartResponseWire,
  HostedOAuthStatusWire,
} from '@/protocols/http/embedder';

export type EmbedderState = EmbedderStateWire;
export type EmbedderKeySave = EmbedderKeySaveResponseWire;
export type HostedAccount = HostedAccountStateWire;
export type EmbedderProvider = EmbedderState['provider'];

/** AI Index source configuration. Credentials pass straight through to the
 *  server and are never retained here. */
export interface EmbedderPort {
  load(signal: AbortSignal): Promise<EmbedderState>;
  refreshAccount(signal: AbortSignal): Promise<HostedAccount>;
  removeKey(signal: AbortSignal): Promise<EmbedderState>;
  saveKey(provider: EmbedderProvider, key: string, signal: AbortSignal): Promise<EmbedderKeySave>;
  selectProvider(provider: EmbedderProvider, signal: AbortSignal): Promise<EmbedderState>;
  signInStatus(flowId: string, signal: AbortSignal): Promise<HostedOAuthStatusWire>;
  signOut(signal: AbortSignal): Promise<void>;
  startSignIn(signal: AbortSignal): Promise<HostedOAuthStartResponseWire>;
  useAccount(signal: AbortSignal): Promise<HostedAccount>;
}

export type EmbedderFailureKind = 'invalid-response' | 'rejected' | 'unavailable';

export class EmbedderError extends Error {
  readonly kind: EmbedderFailureKind;

  constructor(kind: EmbedderFailureKind, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'EmbedderError';
    this.kind = kind;
  }
}
