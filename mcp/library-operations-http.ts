/** HTTP adapter for the separately spawned stdio MCP host. */
import type { LibraryOperations } from '../server/library-operations/index.ts';
import { LibraryOperationError } from '../server/library-operations/errors.ts';

export function createHttpLibraryOperations(webBase: string, windowId?: string): LibraryOperations {
  const headers = (extra?: Record<string, string>): Record<string, string> => ({
    ...(extra ?? {}),
    ...(windowId ? { 'x-stashbase-window-id': windowId } : {}),
  });
  const json = async <T>(url: string, init?: RequestInit): Promise<T> => {
    let response: Response;
    try {
      response = await fetch(url, init);
    } catch (error: unknown) {
      if (error instanceof TypeError) {
        throw new Error('StashBase app is not reachable. Open the StashBase desktop app and try again.');
      }
      throw error;
    }
    if (response.ok) return response.json() as Promise<T>;
    const detail = await response.json().catch(() => ({})) as { error?: unknown; code?: unknown };
    throw new LibraryOperationError(
      typeof detail.error === 'string' ? detail.error : `StashBase request failed: ${response.status}`,
      response.status,
      typeof detail.code === 'string' ? detail.code : undefined,
    );
  };
  const pathQuery = (path: unknown) => `path=${encodeURIComponent(typeof path === 'string' ? path : '')}`;
  return {
    info: () => json(`${webBase}/api/library/info`, { headers: headers() }),
    search: ({ query, topK, folder, pathPrefix }) => json(`${webBase}/api/library/search`, {
      method: 'POST', headers: headers({ 'content-type': 'application/json' }),
      body: JSON.stringify({ query, top_k: topK, ...(folder ? { folder } : {}), ...(pathPrefix ? { path_prefix: pathPrefix } : {}) }),
    }),
    reindex: ({ folder } = {}) => json(`${webBase}/api/library/reindex`, {
      method: 'POST', headers: headers({ 'content-type': 'application/json' }), body: JSON.stringify(folder ? { folder } : {}),
    }),
    listDirectory: (path) => json(`${webBase}/api/library/directory?${pathQuery(path)}`, { headers: headers() }),
    read: (path) => json(`${webBase}/api/library/file?${pathQuery(path)}`, { headers: headers() }),
    write: ({ path, content, baseVersion }) => json(`${webBase}/api/library/file`, {
      method: 'PUT', headers: headers({ 'content-type': 'application/json' }), body: JSON.stringify({ path, content, ...(typeof baseVersion === 'string' ? { baseVersion } : {}) }),
    }),
    edit: ({ path, oldText, newText, replaceAll, baseVersion }) => json(`${webBase}/api/library/file/edit`, {
      method: 'POST', headers: headers({ 'content-type': 'application/json' }),
      body: JSON.stringify({ path, old_text: oldText, new_text: newText, replace_all: replaceAll === true, ...(typeof baseVersion === 'string' ? { baseVersion } : {}) }),
    }),
    move: ({ path, newPath, cascade }) => json(`${webBase}/api/library/file/move`, {
      method: 'PATCH', headers: headers({ 'content-type': 'application/json' }), body: JSON.stringify({ path, new_path: newPath, cascade: cascade !== false }),
    }),
    delete: (path) => json(`${webBase}/api/library/file?${pathQuery(path)}`, { method: 'DELETE', headers: headers() }),
  };
}
