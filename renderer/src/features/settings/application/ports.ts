import type {
  AgentAllowance,
  AgentCatalog,
  AgentDebugPatch,
} from '@/features/settings/domain/agent-catalog';
import type {
  AppearanceChange,
  AppearancePreferences,
} from '@/features/settings/domain/appearance';
import type { McpAccess, McpHttpAccess } from '@/features/settings/domain/mcp-access';
import type {
  TranscriptionModelOperation,
  TranscriptionPreferences,
  TranscriptionPreferencesPatch,
  TranscriptionSettings,
} from '@/features/settings/domain/transcription';
import type { AgentId } from '@/shared/domain/agent-id';
import {
  featureErrorClass,
  type FeatureError,
  type FeatureFailureKind,
  type TransportFailureKind,
} from '@/shared/domain/feature-error';

export interface AgentRuntimePort {
  listAgents(signal: AbortSignal): Promise<AgentCatalog>;
  prepareAgent(
    id: AgentId,
    action: 'check' | 'bootstrap' | 'login',
    signal: AbortSignal,
  ): Promise<AgentCatalog>;
  updateDebug(patch: AgentDebugPatch, signal: AbortSignal): Promise<AgentCatalog>;
  resetManagedAgent(id: AgentId, signal: AbortSignal): Promise<AgentCatalog>;
  getAllowance(signal: AbortSignal): Promise<AgentAllowance>;
}

export type AgentRuntimeFailureKind = TransportFailureKind;

export type AgentRuntimeError = FeatureError;
export const AgentRuntimeError = featureErrorClass('AgentRuntimeError');

export interface TranscriptionPort {
  load(signal: AbortSignal): Promise<TranscriptionSettings>;
  updatePreferences(
    patch: TranscriptionPreferencesPatch,
    signal: AbortSignal,
  ): Promise<TranscriptionPreferences>;
  downloadModel(id: string, signal: AbortSignal): Promise<TranscriptionModelOperation>;
  removeModel(id: string, signal: AbortSignal): Promise<void>;
}

/** Both calls resolve the full triple, because the server's answer is what the
 *  window applies. */
export interface AppearancePort {
  load(signal: AbortSignal): Promise<AppearancePreferences>;
  update(change: AppearanceChange, signal: AbortSignal): Promise<AppearancePreferences>;
}

export interface CapturePreferences {
  readonly clipboardImageImport: boolean;
}

export interface CapturePort {
  load(signal: AbortSignal): Promise<CapturePreferences>;
  update(preferences: CapturePreferences, signal: AbortSignal): Promise<CapturePreferences>;
}

/** The revisions of one-time notices the reader has already answered. Absence
 *  is `null` here; the wire models it as a missing key. */
export interface OnboardingAnswers {
  readonly searchSetupInvitationVersion: number | null;
}

/** The revision of the search-by-meaning setup invitation this build offers.
 *  Raise it to deliberately re-offer a materially changed invitation to
 *  everyone who answered an older one. The server only stores the number this
 *  renderer decides to send, so the current value is the app's policy rather
 *  than wire vocabulary or a domain rule. */
export const SEARCH_SETUP_INVITATION_VERSION = 1;

/** One-time onboarding notices. Answering is durable and application-wide, so
 *  a decline survives a relaunch instead of living in browser storage. */
export interface OnboardingPort {
  answerSearchSetup(version: number, signal: AbortSignal): Promise<OnboardingAnswers>;
  load(signal: AbortSignal): Promise<OnboardingAnswers>;
}

/** The MCP page reads access details and changes how they are reached; it
 *  never configures a third-party client. Each write answers with the listener
 *  state it produced, so the panel never has to guess what took effect. */
export interface McpAccessPort {
  status(signal: AbortSignal): Promise<McpAccess>;
  rotateToken(signal: AbortSignal): Promise<McpHttpAccess>;
  setDockerAccess(enabled: boolean, signal: AbortSignal): Promise<McpHttpAccess>;
  setDockerPort(port: number, signal: AbortSignal): Promise<McpHttpAccess>;
}

export type SettingsFailureKind = FeatureFailureKind<'invalid-request'>;

export type SettingsError = FeatureError<'invalid-request'>;
export const SettingsError = featureErrorClass<'invalid-request'>('SettingsError');
