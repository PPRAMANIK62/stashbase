import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderResult } from '@testing-library/react';
import { StrictMode, type PropsWithChildren, type ReactElement } from 'react';

/** The only QueryClient a test should build. Retries are off so a rejected
 *  port surfaces on the first attempt instead of after a backoff the test
 *  never waits for, and nothing is cached past the test that created it. */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { gcTime: 0, retry: false, refetchOnWindowFocus: false },
    },
  });
}

/** The test client, minus the immediate collection. A query nothing is
 *  observing is garbage-collected the moment it is seeded, so a test that
 *  seeds the cache with `setQueryData` and reads it back without mounting a
 *  component needs the entry to outlive the write. */
export function createRetainingTestQueryClient(): QueryClient {
  const client = createTestQueryClient();
  client.setQueryDefaults([], { gcTime: Number.POSITIVE_INFINITY });
  return client;
}

/** A `renderHook`/`render` wrapper component bound to one client. */
export function queryWrapper(client: QueryClient) {
  return function QueryWrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

export interface QueryRenderOptions {
  /** Renders under `StrictMode`, so double-invoked effects have to settle. */
  readonly strict?: boolean;
}

export interface QueryRenderResult extends RenderResult {
  readonly client: QueryClient;
}

/** Renders `ui` under a fresh test client and hands the client back so the
 *  test can seed or inspect the cache. */
export function withQueryClient(
  ui: ReactElement,
  client: QueryClient = createTestQueryClient(),
  options: QueryRenderOptions = {},
): QueryRenderResult {
  const Wrapper = queryWrapper(client);
  const view = render(
    options.strict ? (
      <StrictMode>
        <Wrapper>{ui}</Wrapper>
      </StrictMode>
    ) : (
      <Wrapper>{ui}</Wrapper>
    ),
  );
  return { ...view, client };
}
