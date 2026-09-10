import { z } from 'zod';

/** `GET /api/capture` and the `PUT /api/capture` echo. */
export const capturePreferencesSchema = z
  .object({ clipboardImageImport: z.boolean() })
  .passthrough();

export const capturePreferencesRequestSchema = z
  .object({ clipboardImageImport: z.boolean() })
  .strict();

export const captureFailureSchema = z
  .object({ error: z.string().trim().min(1).max(500) })
  .passthrough();

export type CapturePreferencesWire = z.infer<typeof capturePreferencesSchema>;
