/**
 * The GitHub acquisition transport.
 *
 * Every refusal this route raises is one the reader can act on — a private or
 * missing repository, a destination already taken, an unsupported repository
 * shape — so the adapter maps the server's code to the sentence rather than
 * forwarding its prose. A code this build does not know falls back to the
 * ladder's own line instead of being guessed at.
 */
import { validateFolderName } from '@/contracts/folder-name';
import { parseGitHubRepositoryUrl } from '@/contracts/github-import';
import { FilesError, type GitHubImportPort } from '@/features/workspace/application/ports';
import {
  request,
  requestOptions,
  type TransportFailure,
  type TransportRequest,
} from '@/platform/http/classify';
import type { HttpClient } from '@/platform/http/client';
import {
  githubImportFailureSchema,
  githubImportRequestSchema,
  githubImportResultSchema,
  type GitHubImportErrorCode,
} from '@/protocols/http/github-import';

const REFUSALS: Readonly<Record<GitHubImportErrorCode, string>> = {
  CLONE_FAILED: 'That repository could not be downloaded. Check your connection and try again.',
  DESTINATION_EXISTS: 'A folder with that name already exists. Choose a different name.',
  GIT_NOT_AVAILABLE: 'Importing needs Git installed and on your PATH.',
  IMPORT_CANCELLED: 'The import was cancelled.',
  INVALID_FOLDER_NAME: 'That folder name cannot be used. Choose a different one.',
  INVALID_GITHUB_URL: 'Enter a complete https://github.com/<owner>/<repo> URL.',
  PRIVATE_OR_NOT_FOUND: 'That repository is private or does not exist.',
  UNSUPPORTED_LFS: 'Repositories that use Git LFS are not supported yet.',
  UNSUPPORTED_SUBMODULES: 'Repositories with submodules are not supported yet.',
};

/** A refusal is the reader's own request coming back, so it reads as the files
 *  ladder's `rejected` with the sentence its code selects. */
function refused({ response }: TransportFailure): FilesError | null {
  if (response.status >= 500) return null;
  const failure = githubImportFailureSchema.safeParse(response.body);
  if (!failure.success) return null;
  const code = failure.data.code;
  return new FilesError('rejected', code ? REFUSALS[code] : failure.data.error);
}

function importRequest(signal: AbortSignal): TransportRequest<'conflict' | 'rejected'> {
  return requestOptions({
    error: FilesError,
    failure: refused,
    messages: {
      'invalid-response': 'The import answered unexpectedly.',
      unavailable: 'That repository could not be imported.',
    },
    path: '/api/github/import',
    signal,
  });
}

export function createGitHubImportAdapter(client: HttpClient): GitHubImportPort {
  return {
    // The URL and destination-name rules are the server's own, mapped here
    // because this is the layer where a repository contract becomes feature
    // vocabulary. Refusing inline with a second approximation would let the
    // two drift; the server still parses both again, so this is feedback
    // rather than authority.
    folderNameIssue: (name) => validateFolderName(name),
    readUrl: (raw) => {
      const parsed = parseGitHubRepositoryUrl(raw);
      return parsed.ok
        ? { folderName: parsed.parsed.defaultFolderName, ok: true as const }
        : { message: parsed.message, ok: false as const };
    },
    async run(url, folderName, signal) {
      const parsed = await request(client, {
        ...importRequest(signal),
        body: githubImportRequestSchema.parse({ folderName, url }),
        method: 'POST',
        schema: githubImportResultSchema,
      });
      return parsed.path;
    },
  };
}
