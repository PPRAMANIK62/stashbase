import {
  AgentContextError,
  type AgentContextPort,
  type AgentUploadOutcome,
  type ResolvedContextFile,
} from '@/features/agent/application/ports';
import type { HttpClient, HttpResponse } from '@/platform/http/client';
import {
  agentAttachResponseSchema,
  agentContextFileFailureSchema,
  agentContextFileResponseSchema,
} from '@/protocols/http/agent-context';

type Fetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function resolveError(response: HttpResponse): AgentContextError {
  const failure = agentContextFileFailureSchema.safeParse(response.body);
  const cause = failure.success ? { cause: new Error(failure.data.error) } : undefined;
  if (response.status === 404) {
    return new AgentContextError('not-found', 'That file is no longer in this folder.', cause);
  }
  if (response.status === 415) {
    return new AgentContextError(
      'unsupported',
      'This file type cannot be given to the Agent.',
      cause,
    );
  }
  return new AgentContextError('unavailable', 'StashBase could not resolve that file.', cause);
}

/** Library source resolution through the JSON client and transient uploads
 *  through the server origin directly, because the JSON client cannot carry
 *  multipart bodies. */
export function createAgentContextApi(
  client: HttpClient,
  serverOrigin: string,
  fetchRequest: Fetch = fetch,
): AgentContextPort {
  const attachTarget = new URL('/api/agent/attach', serverOrigin);
  return {
    async resolve(source, signal): Promise<ResolvedContextFile> {
      const query = new URLSearchParams({ path: `${source.folderPath}/${source.path}` });
      let response: HttpResponse;
      try {
        response = await client.request({
          path: `/api/library/agent-context-file?${query}`,
          signal,
        });
      } catch (error) {
        if (signal.aborted) throw error;
        throw new AgentContextError('unavailable', 'StashBase could not resolve that file.', {
          cause: error,
        });
      }
      if (response.status < 200 || response.status >= 300) throw resolveError(response);
      const parsed = agentContextFileResponseSchema.safeParse(response.body);
      if (!parsed.success) {
        throw new AgentContextError(
          'invalid-response',
          'File resolution returned an invalid response.',
        );
      }
      return parsed.data;
    },
    async upload(files, signal): Promise<AgentUploadOutcome[]> {
      const form = new FormData();
      for (const file of files) form.append('files', file, file.name);
      let response: Response;
      try {
        response = await fetchRequest(attachTarget, { body: form, method: 'POST', signal });
      } catch (error) {
        if (signal.aborted) throw error;
        throw new AgentContextError('unavailable', 'The attachment could not be uploaded.', {
          cause: error,
        });
      }
      let body: unknown = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }
      if (response.status < 200 || response.status >= 300) {
        const failure = agentContextFileFailureSchema.safeParse(body);
        throw new AgentContextError(
          'unavailable',
          failure.success ? failure.data.error : 'The attachment could not be uploaded.',
        );
      }
      const parsed = agentAttachResponseSchema.safeParse(body);
      if (!parsed.success) {
        throw new AgentContextError('invalid-response', 'The upload returned an invalid response.');
      }
      return parsed.data.files;
    },
  };
}
