import { FilesError } from '@/features/workspace/application/ports';
import {
  request,
  transportError,
  type ResponseSchema,
  type TransportRequest,
} from '@/platform/http/classify';
import type { HttpClient } from '@/platform/http/client';
import { fileOperationReceiptSchema } from '@/protocols/http/files';

type FileRequest<T> = TransportRequest<'conflict' | 'rejected' | 'outcome-unknown'> & {
  schema: ResponseSchema<T>;
};

/** Preserve the original identity until a valid response establishes its outcome.
 * Retrying an uncertain operation only reads its receipt, never writes again. */
const unknown = () =>
  new FilesError('outcome-unknown', 'The file operation could not be confirmed.');

export function createFileOperation(client: HttpClient) {
  const unresolved = new Map<string, { id: string; input: string }>();
  return async <T>(options: FileRequest<T>): Promise<T> => {
    if (options.signal?.aborted) throw options.signal.reason;
    const subject = options.path;
    const input = JSON.stringify([options.method, options.body]);
    const prior = unresolved.get(subject);

    if (prior && prior.input !== input) throw unknown();
    const operation = prior ?? { id: crypto.randomUUID(), input };
    unresolved.set(subject, operation);
    if (!prior) {
      try {
        const result = await request(client, {
          ...options,
          path: `${options.path}&operationId=${operation.id}`,
        });
        unresolved.delete(subject);
        return result;
      } catch (error) {
        if (
          error instanceof FilesError &&
          ['conflict', 'rejected', 'unauthorized', 'scope-lost'].includes(error.kind)
        ) {
          unresolved.delete(subject);
          throw error;
        }
        // Transport loss and malformed success bodies require a receipt.
      }
    }
    const folder = new URLSearchParams(options.path.split('?')[1]).get('folder') ?? '';
    let receipt;
    try {
      const response = await client.request({
        path: `/api/file-operations/${operation.id}?${new URLSearchParams({ folder })}`,
        ...(options.signal ? { signal: options.signal } : {}),
      });
      receipt =
        response.status === 200 ? fileOperationReceiptSchema.safeParse(response.body) : null;
    } catch {
      throw unknown();
    }
    if (!receipt?.success) throw unknown();
    const response = receipt.data;
    if (response.status < 200 || response.status >= 300) {
      // A 5xx may follow a partial filesystem operation; do not authorize replay.
      if (response.status >= 500) throw unknown();
      unresolved.delete(subject);
      throw transportError({ status: response.status, body: response.body }, options);
    }
    const parsed = options.schema.safeParse(response.body);
    if (!parsed.success) throw unknown();
    unresolved.delete(subject);
    return parsed.data;
  };
}
