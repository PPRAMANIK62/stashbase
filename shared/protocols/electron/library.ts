import { z } from 'zod';

export const LIBRARY_FOLDER_DIALOG_CAPABILITY = 'library.choose-folder';
export const LIBRARY_FOLDER_DIALOG_CHANNEL = 'library:choose-folder';

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

export type LibraryFolderDialogRequest = z.infer<typeof libraryFolderDialogRequestSchema>;
export type LibraryFolderDialogSuccess = z.infer<typeof libraryFolderDialogSuccessSchema>;
export type LibraryFolderDialogFailure = z.infer<typeof libraryFolderDialogFailureSchema>;
export type LibraryFolderDialogResponse = z.infer<typeof libraryFolderDialogResponseSchema>;
