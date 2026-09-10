import { z } from 'zod';

export const CAPTURE_CAPABILITY = 'capture.clipboard-image';
export const CAPTURE_IMAGE_AVAILABLE_CHANNEL = 'capture:image-available';
export const CAPTURE_REFRESH_WATCH_CHANNEL = 'capture:refresh-watch';
export const CAPTURE_MARK_HANDLED_CHANNEL = 'capture:mark-handled';
export const CAPTURE_MARK_CURRENT_HANDLED_CHANNEL = 'capture:mark-current-handled';
export const CAPTURE_SET_COMPOSER_FOCUSED_CHANNEL = 'capture:set-composer-focused';

const hashSchema = z.string().trim().min(1).max(128);

/** Main pushes this when the focused window's clipboard holds a new image. */
export const captureImageAvailableSchema = z
  .object({
    dataUrl: z.string().min(1).max(64 * 1024 * 1024),
    filename: z.string().trim().min(1).max(255),
    hash: hashSchema,
    height: z.number().int().nonnegative(),
    mime: z.string().trim().min(1).max(128),
    width: z.number().int().nonnegative(),
  })
  .strict();

export const captureRefreshWatchResponseSchema = z.object({ enabled: z.boolean() }).strict();

export const captureMarkHandledRequestSchema = z.object({ hash: hashSchema }).strict();

export const captureSetComposerFocusedRequestSchema = z
  .object({ focused: z.boolean() })
  .strict();

export type CaptureImageAvailable = z.infer<typeof captureImageAvailableSchema>;
export type CaptureRefreshWatchResponse = z.infer<typeof captureRefreshWatchResponseSchema>;
