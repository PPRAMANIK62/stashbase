import { z } from 'zod';

export const embedderProviderSchema = z.enum(['openai', 'openrouter']);
export const embeddingSourceSchema = z.enum(['openai', 'openrouter', 'stashbase-account', 'local']);

const isoDateSchema = z.string().min(1).max(64).nullable();

export const hostedQuotaSchema = z
  .object({
    grantedTokens: z.number().nonnegative(),
    periodEndsAt: isoDateSchema,
    periodStartedAt: isoDateSchema,
    plan: z.string().max(120),
    remainingTokens: z.number().nonnegative(),
    reservedTokens: z.number().nonnegative(),
    usedTokens: z.number().nonnegative(),
  })
  .passthrough();

/** `GET /api/account` and the `account` block of the embedder state. */
export const hostedAccountStateSchema = z
  .object({
    active: z.boolean(),
    avatarUrl: z.string().max(4096).optional(),
    backfillStarted: z.boolean().optional(),
    displayName: z.string().max(240).optional(),
    email: z.string().max(320).optional(),
    quota: hostedQuotaSchema.optional(),
    quotaUnavailable: z.boolean().optional(),
    signedIn: z.boolean(),
  })
  .passthrough();

/** `GET /api/embedder`, and the body every embedder mutation answers with. */
export const embedderStateSchema = z
  .object({
    account: hostedAccountStateSchema,
    authorized: z.boolean(),
    backfillStarted: z.boolean().optional(),
    hasKey: z.boolean(),
    model: z.string().max(240),
    provider: embedderProviderSchema,
    source: embeddingSourceSchema,
  })
  .passthrough();

export const embedderKeyRequestSchema = z
  .object({
    key: z.string().trim().min(1).max(4096),
    provider: embedderProviderSchema,
  })
  .strict();

/** `PUT /api/embedder/key` answers without the account block. */
export const embedderKeySaveResponseSchema = z
  .object({
    authorized: z.literal(true),
    backfillStarted: z.boolean().optional(),
    hasKey: z.literal(true),
    model: z.string().max(240),
    provider: embedderProviderSchema,
    source: embeddingSourceSchema,
    warning: z.string().max(1000).optional(),
  })
  .passthrough();

export const embedderSourceRequestSchema = z.object({ source: embedderProviderSchema }).strict();

export const hostedOAuthStartRequestSchema = z
  .object({
    provider: z.literal('google'),
    purpose: z.enum(['account', 'embedding']),
  })
  .strict();

export const hostedOAuthStartResponseSchema = z
  .object({
    flowId: z.string().min(1).max(256),
    provider: z.literal('google'),
    purpose: z.enum(['account', 'embedding']),
    url: z.string().url().max(4096),
  })
  .passthrough();

export const hostedOAuthStatusSchema = z
  .object({
    appReturned: z.boolean().optional(),
    error: z.string().max(1000).optional(),
    state: z.enum(['pending', 'complete', 'error']),
  })
  .passthrough();

export const embedderFailureSchema = z
  .object({
    code: z.string().trim().min(1).max(64).optional(),
    error: z.string().trim().min(1).max(1000),
  })
  .passthrough();

export type EmbedderStateWire = z.infer<typeof embedderStateSchema>;
export type HostedAccountStateWire = z.infer<typeof hostedAccountStateSchema>;
export type EmbedderKeySaveResponseWire = z.infer<typeof embedderKeySaveResponseSchema>;
export type HostedOAuthStartResponseWire = z.infer<typeof hostedOAuthStartResponseSchema>;
export type HostedOAuthStatusWire = z.infer<typeof hostedOAuthStatusSchema>;
