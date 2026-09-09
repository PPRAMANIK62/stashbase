import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { createElement, type PropsWithChildren } from 'react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import type {
  TranscriptionPort,
  TranscriptionSettings,
} from '@/features/settings/application/ports';

import { useTranscription } from './use-transcription';

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function settings(operation?: {
  status: 'downloading';
  receivedBytes: number;
  totalBytes: number;
}) {
  return {
    language: 'auto',
    modelId: 'base',
    providerId: 'local',
    providers: [
      {
        description: '',
        id: 'local',
        kind: 'local',
        label: 'Local',
        models: [
          {
            available: false,
            id: 'base',
            label: 'Base',
            management: 'local-download',
            ...(operation ? { operation } : {}),
          },
        ],
      },
    ],
  } satisfies TranscriptionSettings;
}

afterEach(cleanup);

describe('useTranscription', () => {
  it('reloads settings after a download starts and polls while it runs', async () => {
    let loads = 0;
    const port: TranscriptionPort = {
      downloadModel: vi.fn(async () => ({
        receivedBytes: 0,
        status: 'downloading' as const,
        totalBytes: 10,
      })),
      load: vi.fn(async () => {
        loads += 1;
        return loads >= 2
          ? settings({ receivedBytes: 1, status: 'downloading' as const, totalBytes: 10 })
          : settings();
      }),
      removeModel: vi.fn(async () => undefined),
      updatePreferences: vi.fn(async () => ({
        language: 'en',
        modelId: 'base',
        providerId: 'local',
      })),
    };
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const hook = renderHook(() => useTranscription(port), { wrapper: wrapper(queryClient) });
    await waitFor(() => expect(hook.result.current.settings.data).toBeDefined());

    await act(async () => {
      await hook.result.current.download.mutateAsync('base');
    });
    await waitFor(() =>
      expect(hook.result.current.settings.data?.providers[0]?.models[0]?.operation?.status).toBe(
        'downloading',
      ),
    );
    await waitFor(() => expect(loads).toBeGreaterThanOrEqual(3), { timeout: 3_000 });
  });
});
