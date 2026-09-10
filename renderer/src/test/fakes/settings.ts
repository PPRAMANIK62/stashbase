/**
 * Settings ports and domain values a test can build in one line.
 *
 * The feature's domain spells absence as `null`, which is honest but wordy to
 * write out at every call site, so the builders below carry the boring
 * defaults and let a test say only what its case is about.
 */

import { vi } from 'vite-plus/test';

import type { EmbedderPort } from '@/features/settings/application/embedder-port';
import type {
  AgentRuntimePort,
  CapturePort,
  McpAccessPort,
  TranscriptionPort,
} from '@/features/settings/application/ports';
import type { AgentAllowance, AgentRuntime } from '@/features/settings/domain/agent-catalog';
import type { EmbedderState, HostedAccount } from '@/features/settings/domain/embedder';
import type { McpAccess, McpHttpAccess } from '@/features/settings/domain/mcp-access';
import type {
  TranscriptionModel,
  TranscriptionProvider,
  TranscriptionSettings,
} from '@/features/settings/domain/transcription';

export const SIGNED_OUT_ACCOUNT: HostedAccount = {
  active: false,
  displayName: null,
  email: null,
  quota: null,
  quotaUnavailable: false,
  signedIn: false,
};

export function embedderState(overrides: Partial<EmbedderState> = {}): EmbedderState {
  return {
    account: SIGNED_OUT_ACCOUNT,
    authorized: false,
    hasKey: false,
    model: 'text-embedding-3-small',
    provider: 'openai',
    source: 'openai',
    ...overrides,
  };
}

/** A signed-in hosted account with a partly spent quota. */
export const SIGNED_IN_ACCOUNT: HostedAccount = {
  active: true,
  displayName: 'Ada Lovelace',
  email: 'ada@example.com',
  quota: {
    grantedTokens: 1000,
    periodEndsAt: '2026-10-01T00:00:00.000Z',
    periodStartedAt: '2026-09-01T00:00:00.000Z',
    plan: 'free',
    remainingTokens: 250,
    reservedTokens: 0,
    usedTokens: 750,
  },
  quotaUnavailable: false,
  signedIn: true,
};

export function embedderPort(
  state: EmbedderState = embedderState(),
  overrides: Partial<EmbedderPort> = {},
): EmbedderPort {
  return {
    load: vi.fn(async () => state),
    refreshAccount: vi.fn(async () => state.account),
    removeKey: vi.fn(async () => embedderState()),
    saveKey: vi.fn(async () => ({ warning: null })),
    selectProvider: vi.fn(async () => state),
    signInStatus: vi.fn(async () => ({ state: 'pending' as const })),
    signOut: vi.fn(async () => undefined),
    startSignIn: vi.fn(async () => ({
      flowId: 'flow-1',
      url: 'https://accounts.example/sign-in',
    })),
    useAccount: vi.fn(async () => state.account),
    ...overrides,
  };
}

export const IDLE_ALLOWANCE: AgentAllowance = {
  cacheReadTokens: 0,
  inputTokens: 0,
  outputTokens: 0,
  remainingPercent: 100,
  windowEndsAt: null,
};

/** One prepared, StashBase-owned runtime. A test names only what its case is
 *  about; everything else is a runtime that is simply ready. */
export function agentRuntime(overrides: Partial<AgentRuntime> = {}): AgentRuntime {
  return {
    id: 'stashbase',
    installed: true,
    label: 'Wiki Agent',
    ownership: 'bundled',
    preparation: { kind: 'ready' },
    ...overrides,
  };
}

export function agentRuntimePort(overrides: Partial<AgentRuntimePort> = {}): AgentRuntimePort {
  const response = { debug: null, runtimes: [agentRuntime()] };
  return {
    getAllowance: vi.fn(async () => IDLE_ALLOWANCE),
    listAgents: vi.fn(async () => response),
    prepareAgent: vi.fn(async () => response),
    resetManagedAgent: vi.fn(async () => response),
    updateDebug: vi.fn(async () => response),
    ...overrides,
  };
}

/** A local, downloadable model that is idle and not installed. */
export function transcriptionModel(
  overrides: Partial<TranscriptionModel> = {},
): TranscriptionModel {
  return {
    accuracy: null,
    available: false,
    id: 'base',
    label: 'Base',
    management: 'local-download',
    operation: { status: 'idle' },
    resourceUse: null,
    sizeBytes: null,
    speed: null,
    ...overrides,
  };
}

export function transcriptionProvider(
  overrides: Partial<TranscriptionProvider> = {},
): TranscriptionProvider {
  return {
    description: 'Runs on this machine.',
    id: 'local',
    kind: 'local',
    label: 'Local (whisper.cpp)',
    models: [],
    runtimeError: null,
    ...overrides,
  };
}

export function transcriptionSettings(
  overrides: Partial<TranscriptionSettings> = {},
): TranscriptionSettings {
  return { language: 'en', modelId: 'base', providerId: 'local', providers: [], ...overrides };
}

export function transcriptionPort(overrides: Partial<TranscriptionPort> = {}): TranscriptionPort {
  return {
    downloadModel: vi.fn(async () => ({ status: 'idle' as const })),
    load: vi.fn(async () => transcriptionSettings()),
    removeModel: vi.fn(async () => undefined),
    updatePreferences: vi.fn(async () => ({
      language: 'en',
      modelId: 'base',
      providerId: 'local',
    })),
    ...overrides,
  };
}

/** A reachable listener with the Docker opt-in left off. */
export function mcpHttpAccess(overrides: Partial<McpHttpAccess> = {}): McpHttpAccess {
  return {
    dockerAccess: false,
    dockerActive: false,
    dockerError: null,
    dockerPort: 8848,
    dockerUrl: 'http://host.docker.internal:8848/mcp',
    loopbackUrl: 'http://127.0.0.1:7777/mcp',
    settingsError: null,
    token: 'token-abc',
    ...overrides,
  };
}

export function mcpAccess(overrides: Partial<McpAccess> = {}): McpAccess {
  return {
    command: '/home/ada/.stashbase/bin/stashbase-mcp',
    config: '{\n  "mcpServers": {}\n}',
    http: mcpHttpAccess(),
    ...overrides,
  };
}

export function mcpAccessPort(overrides: Partial<McpAccessPort> = {}): McpAccessPort {
  const access = mcpAccess();
  return {
    rotateToken: vi.fn(async () => ({ ...access.http, token: 'token-rotated' })),
    setDockerAccess: vi.fn(async (enabled: boolean) => ({ ...access.http, dockerAccess: enabled })),
    setDockerPort: vi.fn(async (port: number) => ({ ...access.http, dockerPort: port })),
    status: vi.fn(async () => access),
    ...overrides,
  };
}

export function capturePort(overrides: Partial<CapturePort> = {}): CapturePort {
  return {
    load: vi.fn(async () => ({ clipboardImageImport: false })),
    update: vi.fn(async (preferences) => preferences),
    ...overrides,
  };
}
