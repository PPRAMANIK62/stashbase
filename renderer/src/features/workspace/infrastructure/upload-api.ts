import {
  FilesError,
  type UploadApi,
  type UploadOutcome,
} from '@/features/workspace/application/ports';

type Fetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

interface UploadResponseBody {
  files?: Array<{ error?: unknown; file?: unknown }>;
  code?: unknown;
  error?: unknown;
}

function mapOutcomes(body: UploadResponseBody | null): UploadOutcome[] {
  if (!body || !Array.isArray(body.files)) {
    throw new FilesError('invalid-response', 'The upload returned an invalid response.');
  }
  return body.files.map((entry) => {
    if (typeof entry?.file !== 'string') {
      throw new FilesError('invalid-response', 'The upload returned an invalid response.');
    }
    return typeof entry.error === 'string'
      ? { error: entry.error, file: entry.file }
      : { file: entry.file };
  });
}

/** Multipart import through `POST /api/upload`. The JSON HTTP client cannot
 *  carry file bodies, so this adapter speaks to the server origin directly. */
export function createUploadApi(serverOrigin: string, fetchRequest: Fetch = fetch): UploadApi {
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
        const scopeLost =
          response.status === 404 ||
          response.status === 412 ||
          body?.code === 'FOLDER_NOT_FOUND' ||
          body?.code === 'NO_FOLDER';
        throw new FilesError(
          scopeLost ? 'scope-lost' : 'unavailable',
          typeof body?.error === 'string' ? body.error : 'The upload failed.',
        );
      }
      return mapOutcomes(body);
    },
  };
}
