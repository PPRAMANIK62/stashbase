import type {
  TranscriptionModelOperationWire,
  TranscriptionPreferencesRequestWire,
  TranscriptionSettingsWire,
} from '@/protocols/http/transcription';
import type { HostedAgentAllowance } from '@/shared/account';
import type { AgentId } from '@/shared/agent-protocol';
import type { AgentRuntimeDebugState, AgentsResponse } from '@/shared/agent-runtime';

export interface AgentRuntimePort {
  listAgents(signal: AbortSignal): Promise<AgentsResponse>;
  prepareAgent(
    id: AgentId,
    action: 'check' | 'bootstrap' | 'login',
    signal: AbortSignal,
  ): Promise<AgentsResponse>;
  updateDebug(
    patch: Partial<Omit<AgentRuntimeDebugState, 'enabled'>>,
    signal: AbortSignal,
  ): Promise<AgentsResponse>;
  resetManagedAgent(id: AgentId, signal: AbortSignal): Promise<AgentsResponse>;
  getAllowance(signal: AbortSignal): Promise<HostedAgentAllowance>;
}

export type AgentRuntimeFailureKind = 'invalid-response' | 'unavailable';

export class AgentRuntimeError extends Error {
  readonly kind: AgentRuntimeFailureKind;

  constructor(kind: AgentRuntimeFailureKind, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'AgentRuntimeError';
    this.kind = kind;
  }
}

export type TranscriptionSettings = TranscriptionSettingsWire;
export type TranscriptionPreferencesPatch = TranscriptionPreferencesRequestWire;
export type TranscriptionModelOperation = TranscriptionModelOperationWire;

export interface TranscriptionPort {
  load(signal: AbortSignal): Promise<TranscriptionSettings>;
  updatePreferences(
    patch: TranscriptionPreferencesPatch,
    signal: AbortSignal,
  ): Promise<{ language: string; modelId: string; providerId: string }>;
  downloadModel(id: string, signal: AbortSignal): Promise<TranscriptionModelOperation>;
  removeModel(id: string, signal: AbortSignal): Promise<void>;
}

export interface CapturePreferences {
  readonly clipboardImageImport: boolean;
}

export interface CapturePort {
  load(signal: AbortSignal): Promise<CapturePreferences>;
  update(preferences: CapturePreferences, signal: AbortSignal): Promise<CapturePreferences>;
}

export type SettingsFailureKind = 'invalid-request' | 'invalid-response' | 'unavailable';

export class SettingsError extends Error {
  readonly kind: SettingsFailureKind;

  constructor(kind: SettingsFailureKind, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'SettingsError';
    this.kind = kind;
  }
}
