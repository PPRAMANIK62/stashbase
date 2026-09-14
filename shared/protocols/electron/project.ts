import { z } from 'zod';

export const PROJECT_FOLDER_DIALOG_CAPABILITY = 'project.choose-folder';
export const PROJECT_FOLDER_DIALOG_CHANNEL = 'project:choose-folder';
export const PROJECT_LIFECYCLE_CAPABILITY = 'project.lifecycle';
export const PROJECT_SET_ACTIVE_FOLDER_CHANNEL = 'project:set-active-folder';
export const PROJECT_OPEN_FOLDER_WINDOW_CHANNEL = 'project:open-folder-window';
export const PROJECT_CLAIM_INITIAL_FOLDER_CHANNEL = 'project:claim-initial-folder';
export const PROJECT_PREPARE_FOLDER_REMOVAL_CHANNEL = 'project:prepare-folder-removal';
export const PROJECT_FOLDER_REMOVAL_REQUESTED_CHANNEL = 'project:folder-removal-requested';
export const PROJECT_FOLDER_REMOVAL_READY_CHANNEL = 'project:folder-removal-ready';
export const PROJECT_NOTIFY_FOLDER_REMOVED_CHANNEL = 'project:notify-folder-removed';
export const PROJECT_FOLDER_REMOVED_CHANNEL = 'project:folder-removed';

const folderPathSchema = z.string().min(1).max(4096)
  .refine((value) => value.trim().length > 0, 'Path must contain a visible character.');

export const projectFolderDialogRequestSchema = z
  .object({
    allowCreateDirectory: z.boolean().default(true),
    defaultPath: folderPathSchema.optional(),
  })
  .strict();

export const projectFolderDialogSuccessSchema = z.object({
  folderPath: folderPathSchema.nullable(),
  ok: z.literal(true),
});

export const projectFolderDialogFailureSchema = z.object({
  failure: z
    .object({
      kind: z.enum(['unauthorized', 'unavailable', 'invalid-response', 'fatal']),
      message: z.string().trim().min(1).max(240),
    })
    .strict(),
  ok: z.literal(false),
});

export const projectFolderDialogResponseSchema = z.union([
  projectFolderDialogSuccessSchema,
  projectFolderDialogFailureSchema,
]);

export const projectFolderPathRequestSchema = z.object({ folderPath: folderPathSchema }).strict();

export const projectSetActiveFolderRequestSchema = z
  .object({ folderPath: folderPathSchema.nullable() })
  .strict();

export const projectFolderRemovalRequestedSchema = z
  .object({
    folderPath: folderPathSchema,
    requestId: z.string().trim().min(1).max(128),
  })
  .strict();

export const projectFolderRemovalReadySchema = projectFolderRemovalRequestedSchema
  .extend({ ready: z.boolean() })
  .strict();

export const projectLifecycleSuccessSchema = z.object({ ok: z.literal(true) }).strict();

export const projectPrepareFolderRemovalSuccessSchema = z
  .object({ ok: z.literal(true), ready: z.boolean() })
  .strict();

/** Opening a member in a window answers which of the two things happened, so
 *  a caller can say "opened it" without claiming a second window that main
 *  deliberately did not make: a folder already on screen is focused instead. */
export const projectOpenFolderWindowSuccessSchema = z
  .object({ ok: z.literal(true), action: z.enum(['opened', 'focused']) })
  .strict();

/** Claiming carries nothing: the window asking is the window being answered,
 *  and main reads its identity from the sender it already authorized. Stated
 *  here so both sides refuse a payload rather than one side ignoring it. */
export const projectInitialFolderRequestSchema = z.undefined();

/** The folder main created this window for, answered at most once: main
 *  forgets it as the claim is made, so a window that reloads does not land
 *  again on a folder its reader has since left. `null` is the ordinary answer
 *  for a window nobody named a folder for, not a failure to report. Strict,
 *  like every other answer main and this preload ship together. */
export const projectInitialFolderSuccessSchema = z
  .object({ folderPath: folderPathSchema.nullable(), ok: z.literal(true) })
  .strict();

export const projectLifecycleResponseSchema = z.union([
  projectLifecycleSuccessSchema,
  projectFolderDialogFailureSchema,
]);

export const projectInitialFolderResponseSchema = z.union([
  projectInitialFolderSuccessSchema,
  projectFolderDialogFailureSchema,
]);

export const projectPrepareFolderRemovalResponseSchema = z.union([
  projectPrepareFolderRemovalSuccessSchema,
  projectFolderDialogFailureSchema,
]);

export const projectOpenFolderWindowResponseSchema = z.union([
  projectOpenFolderWindowSuccessSchema,
  projectFolderDialogFailureSchema,
]);

export type ProjectFolderDialogRequest = z.infer<typeof projectFolderDialogRequestSchema>;
export type ProjectFolderDialogSuccess = z.infer<typeof projectFolderDialogSuccessSchema>;
export type ProjectFolderDialogFailure = z.infer<typeof projectFolderDialogFailureSchema>;
export type ProjectFolderDialogResponse = z.infer<typeof projectFolderDialogResponseSchema>;
export type ProjectFolderPathRequest = z.infer<typeof projectFolderPathRequestSchema>;
export type ProjectFolderRemovalRequested = z.infer<
  typeof projectFolderRemovalRequestedSchema
>;
export type ProjectLifecycleResponse = z.infer<typeof projectLifecycleResponseSchema>;
export type ProjectPrepareFolderRemovalResponse = z.infer<
  typeof projectPrepareFolderRemovalResponseSchema
>;
export type ProjectOpenFolderWindowResponse = z.infer<
  typeof projectOpenFolderWindowResponseSchema
>;
export type ProjectInitialFolderResponse = z.infer<typeof projectInitialFolderResponseSchema>;
