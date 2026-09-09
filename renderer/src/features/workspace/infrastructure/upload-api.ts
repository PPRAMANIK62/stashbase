import { FilesError, type UploadPort } from '@/features/workspace/application/ports';
import { classifyResponse } from '@/platform/http/classify';

type Fetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

interface UploadResponseBody {
  files?: Array<{ error?: unknown; file?: unknown }>;
  code?: unknown;
  error?: unknown;
}

/** The route reports a per-file refusal inside an otherwise successful body.
 *  It becomes a rejection on the files ladder here, so no caller has to
 *  remember to inspect a resolved result for a failure. */
function settledPaths(body: UploadResponseBody | null): string[] {
  if (!body || !Array.isArray(body.files)) {
    throw new FilesError('invalid-response', 'The upload returned an invalid response.');
  }
  return body.files.map((entry) => {
    if (typeof entry?.file !== 'string') {
      throw new FilesError('invalid-response', 'The upload returned an invalid response.');
    }
    if (typeof entry.error === 'string') {
      throw new FilesError('rejected', 'The server refused one of the uploaded files.', {
        cause: new Error(entry.error),
      });
    }
    return entry.file;
  });
}

/** Multipart import through `POST /api/upload`. The JSON HTTP client cannot
 *  carry file bodies, so this adapter speaks to the server origin directly. */
export function createUploadAdapter(serverOrigin: string, fetchRequest: Fetch = fetch): UploadPort {
  const target = new URL('/api/upload', serverOrigin);
  return {
    async upload(folderPath, files, signal) {
      const form = new FormData();
      form.set('folder', folderPath);
      for (const file of files) {
        form.append('files', new File([file.blob], file.name, { type: file.blob.type }));
        form.append('paths', file.name);
      }
      let response: Response;
      try {
        response = await fetchRequest(target, { body: form, method: 'POST', signal });
      } catch (error) {
        if (signal.aborted) throw error;
        throw new FilesError('unavailable', 'The upload could not reach StashBase.', {
          cause: error,
        });
      }
      let body: UploadResponseBody | null = null;
      try {
        body = (await response.json()) as UploadResponseBody;
      } catch {
        body = null;
      }
      if (response.status < 200 || response.status >= 300) {
        // Multipart cannot go through the JSON client, so the shared ladder is
        // applied here to the status the upload route answered with.
        const folderGone = body?.code === 'FOLDER_NOT_FOUND' || body?.code === 'NO_FOLDER';
        throw new FilesError(
          folderGone ? 'scope-lost' : classifyResponse({ body, status: response.status }),
          typeof body?.error === 'string' ? body.error : 'The upload failed.',
        );
      }
      return settledPaths(body);
    },
  };
}
