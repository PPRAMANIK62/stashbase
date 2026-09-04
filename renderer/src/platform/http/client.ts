export interface HttpRequest {
  body?: unknown;
  method?: 'GET' | 'HEAD' | 'POST' | 'PUT';
  path: string;
  signal?: AbortSignal;
}

export interface HttpResponse {
  body: unknown;
  headers?: Readonly<Record<string, string>>;
  status: number;
}

export interface HttpClient {
  request(request: HttpRequest): Promise<HttpResponse>;
}

type Fetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export function createHttpClient(serverOrigin: string, fetchRequest: Fetch = fetch): HttpClient {
  const baseUrl = new URL(serverOrigin);
  return {
    async request({ body, method = 'GET', path, signal }) {
      const headers = new Headers({ accept: 'application/json' });
      const init: RequestInit = { headers, method, signal };
      if (body !== undefined) {
        headers.set('content-type', 'application/json');
        init.body = JSON.stringify(body);
      }
      const response = await fetchRequest(new URL(path, baseUrl), init);
      let responseBody: unknown = null;
      try {
        responseBody = await response.json();
      } catch {
        // The protocol adapter classifies an absent or malformed JSON body.
      }
      return method === 'HEAD'
        ? {
            body: responseBody,
            headers: Object.fromEntries(response.headers.entries()),
            status: response.status,
          }
        : { body: responseBody, status: response.status };
    },
  };
}
