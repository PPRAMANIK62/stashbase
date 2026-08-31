import { z } from 'zod';

export const WORKSPACE_FOLDER_DIALOG_CAPABILITY = 'workspace.choose-folder';
export const WORKSPACE_FOLDER_DIALOG_CHANNEL = 'workspace:choose-folder';

const folderPathSchema = z.string().trim().min(1).max(4096);

export const workspaceFolderDialogRequestSchema = z
  .object({
    allowCreateDirectory: z.boolean().default(true),
    defaultPath: folderPathSchema.optional(),
  })
  .strict();

export const workspaceFolderDialogSuccessSchema = z.object({
  folderPath: folderPathSchema.nullable(),
  ok: z.literal(true),
});

export const workspaceFolderDialogFailureSchema = z.object({
  failure: z
    .object({
      kind: z.enum(['unauthorized', 'unavailable', 'invalid-response', 'fatal']),
      message: z.string().trim().min(1).max(240),
    })
    .strict(),
  ok: z.literal(false),
});

export const workspaceFolderDialogResponseSchema = z.union([
  workspaceFolderDialogSuccessSchema,
  workspaceFolderDialogFailureSchema,
]);

export type WorkspaceFolderDialogRequest = z.infer<typeof workspaceFolderDialogRequestSchema>;
export type WorkspaceFolderDialogSuccess = z.infer<typeof workspaceFolderDialogSuccessSchema>;
export type WorkspaceFolderDialogFailure = z.infer<typeof workspaceFolderDialogFailureSchema>;
export type WorkspaceFolderDialogResponse = z.infer<typeof workspaceFolderDialogResponseSchema>;
