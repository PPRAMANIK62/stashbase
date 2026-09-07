import { z } from 'zod';

export const agentIdSchema = z.enum(['stashbase', 'claude', 'codex']);

export const agentBootstrapPhaseSchema = z.enum([
  'idle',
  'installing',
  'authenticating',
  'configuring',
  'ready',
  'failed',
]);

export const agentBootstrapFailureStageSchema = z.enum([
  'discovery',
  'installation',
  'authentication',
  'mcp',
]);

export const agentBootstrapFailureCodeSchema = z.enum([
  'simulated',
  'operation-failed',
  'runtime-unavailable',
  'account-required',
  'authentication-required',
  'authentication-check-failed',
]);

export const agentBootstrapManualRecoverySchema = z.enum(['install-command', 'mcp-settings']);

export const agentBootstrapFailureSchema = z
  .object({
    stage: agentBootstrapFailureStageSchema,
    code: agentBootstrapFailureCodeSchema,
    message: z.string().max(2000),
    retryable: z.boolean(),
    manualRecovery: agentBootstrapManualRecoverySchema.optional(),
  })
  .strict();

export const agentBootstrapStatusSchema = z
  .object({
    phase: agentBootstrapPhaseSchema,
    progress: z.number().finite().optional(),
    message: z.string().max(2000).optional(),
    failure: agentBootstrapFailureSchema.optional(),
  })
  .strict();

export const agentDiscoveryPolicySchema = z.enum(['auto', 'managed-only', 'system-only']);

export const agentSetupFailureSimulationSchema = z.enum([
  'none',
  'installation',
  'authentication',
  'mcp',
]);

export const agentTurnFailureSimulationSchema = z.enum([
  'none',
  'rate-limit',
  'quota',
  'auth-expired',
  'network',
  'crash',
]);

export const agentRuntimeDebugStateSchema = z
  .object({
    enabled: z.boolean(),
    discoveryPolicy: agentDiscoveryPolicySchema,
    nextFailure: agentSetupFailureSimulationSchema,
    nextTurnFailure: agentTurnFailureSimulationSchema,
  })
  .strict();

export const agentRuntimeDebugPatchRequestSchema = z
  .object({
    discoveryPolicy: agentDiscoveryPolicySchema.optional(),
    nextFailure: agentSetupFailureSimulationSchema.optional(),
    nextTurnFailure: agentTurnFailureSimulationSchema.optional(),
  })
  .strict();

export const agentSourceSchema = z.enum(['bundled', 'system', 'managed']);

export const agentCapabilitiesSchema = z
  .object({
    connection: z.literal(true),
    prompts: z.literal(true),
    interrupt: z.literal(true),
    transcript: z.literal(true),
    approvals: z.literal(true),
    history: z.literal(true),
    attachments: z.boolean(),
    modes: z.boolean(),
    effort: z.boolean(),
    models: z.boolean(),
    skills: z.boolean(),
    steering: z.boolean(),
    titleHint: z.boolean(),
  })
  .strict();

export const agentSchema = z
  .object({
    id: agentIdSchema,
    label: z.string().min(1).max(200),
    vendor: z.string().min(1).max(200),
    installHint: z.string().max(2000),
    installed: z.boolean(),
    source: agentSourceSchema.nullable().optional(),
    bootstrap: agentBootstrapStatusSchema.optional(),
    launchCommand: z.string().max(2000),
    endpoint: z.string().max(2000).optional(),
    state: z.enum(['available', 'unavailable', 'failed']).optional(),
    error: z.string().max(2000).optional(),
    capabilities: agentCapabilitiesSchema.optional(),
  })
  .strict();

export const agentsResponseSchema = z
  .object({
    clis: z.array(agentSchema).max(64),
    debug: agentRuntimeDebugStateSchema.optional(),
  })
  .strict();

export const hostedAgentAllowanceSchema = z
  .object({
    profile: z.string().min(1).max(200),
    remainingPercent: z.number().finite(),
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    cacheReadTokens: z.number().int().nonnegative(),
    windowStartedAt: z.string().nullable(),
    windowEndsAt: z.string().nullable(),
  })
  .strict();

export const agentRuntimeFailureSchema = z
  .object({
    code: z.string().trim().min(1).max(64).optional(),
    error: z.string().trim().min(1).max(500),
  })
  .passthrough();

export type AgentBootstrapPhaseWire = z.infer<typeof agentBootstrapPhaseSchema>;
export type AgentBootstrapFailureWire = z.infer<typeof agentBootstrapFailureSchema>;
export type AgentBootstrapStatusWire = z.infer<typeof agentBootstrapStatusSchema>;
export type AgentRuntimeDebugStateWire = z.infer<typeof agentRuntimeDebugStateSchema>;
export type AgentRuntimeDebugPatchRequestWire = z.infer<typeof agentRuntimeDebugPatchRequestSchema>;
export type AgentWire = z.infer<typeof agentSchema>;
export type AgentsResponseWire = z.infer<typeof agentsResponseSchema>;
export type HostedAgentAllowanceWire = z.infer<typeof hostedAgentAllowanceSchema>;
