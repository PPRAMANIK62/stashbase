import { z } from 'zod';

/** Why an import was refused, as one code per refusal a reader can act on.
 *  The renderer switches on the code to choose its sentence; it never parses
 *  the server's prose. */
export const githubImportErrorCodeSchema = z.enum([
  'INVALID_GITHUB_URL',
  'INVALID_FOLDER_NAME',
  'DESTINATION_EXISTS',
  'GIT_NOT_AVAILABLE',
  'PRIVATE_OR_NOT_FOUND',
  'UNSUPPORTED_LFS',
  'UNSUPPORTED_SUBMODULES',
  'CLONE_FAILED',
  'IMPORT_CANCELLED',
]);

export const githubImportRequestSchema = z
  .object({
    /** The canonical `https://github.com/<owner>/<repo>` the reader pasted.
     *  The server parses it again; sending the raw text keeps one owner for
     *  the rule rather than trusting a client-side normalization. */
    url: z.string().trim().min(1).max(2_048),
    folderName: z.string().trim().min(1).max(64),
  })
  .strict();

/** Success carries only the published destination. Nothing about staging
 *  reaches the renderer, because staging is not a place it may act on. */
export const githubImportResultSchema = z.object({ path: z.string().min(1) }).strip();

export const githubImportFailureSchema = z
  .object({
    code: githubImportErrorCodeSchema.optional(),
    error: z.string().trim().min(1).max(500),
  })
  .strip();

export type GitHubImportErrorCode = z.infer<typeof githubImportErrorCodeSchema>;
export type GitHubImportResultWire = z.infer<typeof githubImportResultSchema>;
