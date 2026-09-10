import { z } from 'zod';

const folderPathSchema = z.string().trim().min(1).max(4096);
const relativePathSchema = z.string().trim().min(1).max(4096);

/** Shared body for `POST /api/files/prepare` and `POST /api/files/cancel-preparation`. */
export const preparationSourceRequestSchema = z
  .object({
    folder: folderPathSchema,
    path: relativePathSchema,
  })
  .strict();

/** `POST /api/files/reprocess`; `language` applies to media sources only. */
export const preparationReprocessRequestSchema = preparationSourceRequestSchema
  .extend({
    language: z.string().trim().min(1).max(32).optional(),
  })
  .strict();

export const preparationAcknowledgementSchema = z.object({ ok: z.literal(true) }).passthrough();

export const preparationReprocessResponseSchema = z
  .object({
    mode: z.enum(['conversion', 'index']),
    ok: z.literal(true),
  })
  .passthrough();

export const preparationCancelResponseSchema = z
  .object({
    cancelled: z.boolean(),
    ok: z.literal(true),
  })
  .passthrough();

export const preparationFailureResponseSchema = z
  .object({
    code: z.string().trim().min(1).max(64).optional(),
    error: z.string().trim().min(1).max(500),
  })
  .passthrough();

export type PreparationSourceRequestWire = z.infer<typeof preparationSourceRequestSchema>;
export type PreparationReprocessRequestWire = z.infer<typeof preparationReprocessRequestSchema>;
export type PreparationReprocessResponseWire = z.infer<typeof preparationReprocessResponseSchema>;
