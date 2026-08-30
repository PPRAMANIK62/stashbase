export type GetJsonResult =
  | { kind: 'response'; status: number; body: unknown }
  | { kind: 'invalid-response'; status: number; cause: unknown };

export type GetJson = (path: string, signal: AbortSignal) => Promise<GetJsonResult>;

export function createGetJson(fetchImplementation: typeof fetch): GetJson {
  return async (path, signal) => {
    const response = await fetchImplementation(path, {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal,
    });

    try {
      return {
        kind: 'response',
        status: response.status,
        body: await response.json(),
      };
    } catch (cause) {
      return {
        kind: 'invalid-response',
        status: response.status,
        cause,
      };
    }
  };
}
