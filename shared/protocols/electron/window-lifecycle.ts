import { z } from 'zod';

export const WINDOW_LIFECYCLE_CAPABILITY = 'window.lifecycle';
export const WINDOW_PREPARE_CONTEXT_RELEASE_CHANNEL = 'window:prepare-context-release';
export const WINDOW_CONTEXT_RELEASE_READY_CHANNEL = 'window:context-release-ready';
export const WINDOW_SAFE_RELOAD_CHANNEL = 'window:safe-reload';
export const WINDOW_FULLSCREEN_CHANNEL = 'window:fullscreen';

export const windowContextReleaseReasonSchema = z.enum([
  'window-close',
  'window-reload',
  'update-install',
]);

export const windowContextReleaseRequestSchema = z
  .object({
    reason: windowContextReleaseReasonSchema,
    requestId: z.string().trim().min(1).max(128),
  })
  .strict();

export const windowContextReleaseReadySchema = windowContextReleaseRequestSchema
  .extend({ ready: z.boolean() })
  .strict();

export const windowLifecycleResponseSchema = z
  .object({ ok: z.literal(true), reloaded: z.boolean() })
  .strict();

/** Main to renderer: whether the window is in native fullscreen, sent on every
 *  change and once the document has loaded. The shell lays itself out around
 *  the platform's own chrome, which fullscreen hides. */
export const windowFullScreenSchema = z.object({ fullscreen: z.boolean() }).strict();

export type WindowContextReleaseReason = z.infer<typeof windowContextReleaseReasonSchema>;
export type WindowLifecycleResponse = z.infer<typeof windowLifecycleResponseSchema>;
