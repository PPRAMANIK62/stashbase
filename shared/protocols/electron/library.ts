import { z } from 'zod';

export const LIBRARY_FOLDER_DIALOG_CAPABILITY = 'library.choose-folder';
export const LIBRARY_FOLDER_DIALOG_CHANNEL = 'library:choose-folder';
export const LIBRARY_LIFECYCLE_CAPABILITY = 'library.lifecycle';
export const LIBRARY_SET_ACTIVE_FOLDER_CHANNEL = 'library:set-active-folder';
export const LIBRARY_OPEN_FOLDER_WINDOW_CHANNEL = 'library:open-folder-window';
export const LIBRARY_PREPARE_FOLDER_REMOVAL_CHANNEL = 'library:prepare-folder-removal';
export const LIBRARY_FOLDER_REMOVAL_REQUESTED_CHANNEL = 'library:folder-removal-requested';
export const LIBRARY_FOLDER_REMOVAL_READY_CHANNEL = 'library:folder-removal-ready';
export const LIBRARY_NOTIFY_FOLDER_REMOVED_CHANNEL = 'library:notify-folder-removed';
export const LIBRARY_FOLDER_REMOVED_CHANNEL = 'library:folder-removed';

const folderPathSchema = z.string().trim().min(1).max(4096);

export const libraryFolderDialogRequestSchema = z
  .object({
    allowCreateDirectory: z.boolean().default(true),
    defaultPath: folderPathSchema.optional(),
  })
  .strict();

export const libraryFolderDialogSuccessSchema = z.object({
  folderPath: folderPathSchema.nullable(),
  ok: z.literal(true),
});

export const libraryFolderDialogFailureSchema = z.object({
  failure: z
    .object({
      kind: z.enum(['unauthorized', 'unavailable', 'invalid-response', 'fatal']),
      message: z.string().trim().min(1).max(240),
    })
    .strict(),
  ok: z.literal(false),
});

export const libraryFolderDialogResponseSchema = z.union([
  libraryFolderDialogSuccessSchema,
  libraryFolderDialogFailureSchema,
]);

export const libraryFolderPathRequestSchema = z.object({ folderPath: folderPathSchema }).strict();

export const librarySetActiveFolderRequestSchema = z
  .object({ folderPath: folderPathSchema.nullable() })
  .strict();

export const libraryFolderRemovalRequestedSchema = z
  .object({
    folderPath: folderPathSchema,
    requestId: z.string().trim().min(1).max(128),
  })
  .strict();

export const libraryFolderRemovalReadySchema = libraryFolderRemovalRequestedSchema
  .extend({ ready: z.boolean() })
  .strict();

export const libraryLifecycleSuccessSchema = z.object({ ok: z.literal(true) }).strict();

export const libraryPrepareFolderRemovalSuccessSchema = z
  .object({ ok: z.literal(true), ready: z.boolean() })
  .strict();

/** Opening a member in a window answers which of the two things happened, so
 *  a caller can say "opened it" without claiming a second window that main
 *  deliberately did not make: a folder already on screen is focused instead. */
export const libraryOpenFolderWindowSuccessSchema = z
  .object({ ok: z.literal(true), action: z.enum(['opened', 'focused']) })
  .strict();

export const libraryLifecycleResponseSchema = z.union([
  libraryLifecycleSuccessSchema,
  libraryFolderDialogFailureSchema,
]);

export const libraryPrepareFolderRemovalResponseSchema = z.union([
  libraryPrepareFolderRemovalSuccessSchema,
  libraryFolderDialogFailureSchema,
]);

export const libraryOpenFolderWindowResponseSchema = z.union([
  libraryOpenFolderWindowSuccessSchema,
  libraryFolderDialogFailureSchema,
]);

export type LibraryFolderDialogRequest = z.infer<typeof libraryFolderDialogRequestSchema>;
export type LibraryFolderDialogSuccess = z.infer<typeof libraryFolderDialogSuccessSchema>;
export type LibraryFolderDialogFailure = z.infer<typeof libraryFolderDialogFailureSchema>;
export type LibraryFolderDialogResponse = z.infer<typeof libraryFolderDialogResponseSchema>;
export type LibraryFolderPathRequest = z.infer<typeof libraryFolderPathRequestSchema>;
export type LibrarySetActiveFolderRequest = z.infer<typeof librarySetActiveFolderRequestSchema>;
export type LibraryFolderRemovalRequested = z.infer<
  typeof libraryFolderRemovalRequestedSchema
>;
export type LibraryFolderRemovalReady = z.infer<typeof libraryFolderRemovalReadySchema>;
export type LibraryLifecycleResponse = z.infer<typeof libraryLifecycleResponseSchema>;
export type LibraryPrepareFolderRemovalResponse = z.infer<
  typeof libraryPrepareFolderRemovalResponseSchema
>;
export type LibraryOpenFolderWindowResponse = z.infer<
  typeof libraryOpenFolderWindowResponseSchema
>;
