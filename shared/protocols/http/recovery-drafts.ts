import { z } from 'zod';

/** A snapshot is bounded in bytes on the server; the wire bounds characters
 *  at the same number so an oversized body is refused before it is decoded. */
export const RECOVERY_DRAFT_MAX_CONTENT_BYTES = 2 * 1024 * 1024;

const folderPathSchema = z.string().trim().min(1).max(4096);
const relativePathSchema = z.string().trim().min(1).max(4096);
const sourceVersionSchema = z.string().trim().min(1).max(256);
const draftContentSchema = z.string().max(RECOVERY_DRAFT_MAX_CONTENT_BYTES);
const savedAtSchema = z.string().datetime();

/** Identity of one draft: the source it was typed over. The server keys its
 *  store by this pair, so no separate id crosses the wire. */
export const recoveryDraftIdentitySchema = z
  .object({
    folderPath: folderPathSchema,
    path: relativePathSchema,
  })
  .strict();

export const recoveryDraftSummarySchema = z
  .object({
    /** The source's version on disk now, or null when the file is gone. */
    currentVersion: sourceVersionSchema.nullable(),
    expectedVersion: sourceVersionSchema,
    folderPath: folderPathSchema,
    path: relativePathSchema,
    savedAt: savedAtSchema,
  })
  .strict();

export const recoveryDraftListResponseSchema = z.discriminatedUnion('available', [
  z.object({ available: z.literal(true), drafts: z.array(recoveryDraftSummarySchema) }).strict(),
  z.object({ available: z.literal(false), reason: z.enum(['no-key']) }).strict(),
]);

export const recoveryDraftContentResponseSchema = recoveryDraftSummarySchema
  .extend({ content: draftContentSchema })
  .strict();

export const recoveryDraftWriteRequestSchema = recoveryDraftIdentitySchema
  .extend({
    content: draftContentSchema,
    expectedVersion: sourceVersionSchema,
  })
  .strict();

export const recoveryDraftWriteResponseSchema = z.object({ savedAt: savedAtSchema }).strict();

export const recoveryDraftDiscardResponseSchema = z.object({}).strict();

export const recoveryDraftFailureSchema = z
  .object({
    code: z
      .enum(['DRAFT_TOO_LARGE', 'FOLDER_UNAVAILABLE', 'INVALID_PATH', 'NOT_FOUND', 'RECOVERY_UNAVAILABLE'])
      .optional(),
    error: z.string().trim().min(1).max(500),
  })
  .strict();

export type RecoveryDraftIdentityWire = z.infer<typeof recoveryDraftIdentitySchema>;
export type RecoveryDraftSummaryWire = z.infer<typeof recoveryDraftSummarySchema>;
export type RecoveryDraftListResponseWire = z.infer<typeof recoveryDraftListResponseSchema>;
export type RecoveryDraftContentResponseWire = z.infer<typeof recoveryDraftContentResponseSchema>;
export type RecoveryDraftWriteRequestWire = z.infer<typeof recoveryDraftWriteRequestSchema>;
export type RecoveryDraftWriteResponseWire = z.infer<typeof recoveryDraftWriteResponseSchema>;
export type RecoveryDraftFailureWire = z.infer<typeof recoveryDraftFailureSchema>;
