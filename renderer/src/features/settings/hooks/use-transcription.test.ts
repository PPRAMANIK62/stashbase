import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import type { TranscriptionModelOperation } from '@/features/settings/domain/transcription';
import {
  transcriptionModel,
  transcriptionPort,
  transcriptionProvider,
  transcriptionSettings,
} from '@/test/fakes/settings';
import { createTestQueryClient, queryWrapper } from '@/test/query';

import { useTranscription } from './use-transcription';

function settings(operation: TranscriptionModelOperation = { status: 'idle' }) {
  return transcriptionSettings({
    language: 'auto',
    providers: [transcriptionProvider({ models: [transcriptionModel({ operation })] })],
  });
}

afterEach(cleanup);

describe('useTranscription', () => {
  it('reloads settings after a download starts and polls while it runs', async () => {
    let loads = 0;
    const port = transcriptionPort({
      downloadModel: vi.fn(async () => ({
        receivedBytes: 0,
        status: 'downloading' as const,
        totalBytes: 10,
      })),
      load: vi.fn(async () => {
        loads += 1;
        return loads >= 2
          ? settings({ receivedBytes: 1, status: 'downloading', totalBytes: 10 })
          : settings();
      }),
    });
    const hook = renderHook(() => useTranscription(port), {
      wrapper: queryWrapper(createTestQueryClient()),
    });
    await waitFor(() => expect(hook.result.current.settings).not.toBeNull());

    act(() => hook.result.current.download('base'));

    await waitFor(() =>
      expect(hook.result.current.models[0]?.operation.status).toBe('downloading'),
    );
    expect(hook.result.current.busy).toBe(true);
    await waitFor(() => expect(loads).toBeGreaterThanOrEqual(3), { timeout: 3_000 });
  });

  it('picks an installed model for the engine the reader switches to', async () => {
    const remote = transcriptionProvider({
      id: 'remote',
      kind: 'remote',
      label: 'Hosted',
      models: [
        transcriptionModel({ id: 'cloud-large', label: 'Large' }),
        transcriptionModel({ available: true, id: 'cloud-fast', label: 'Fast' }),
      ],
    });
    const port = transcriptionPort({
      load: vi.fn(async () =>
        transcriptionSettings({
          providers: [transcriptionProvider({ models: [transcriptionModel()] }), remote],
        }),
      ),
    });
    const hook = renderHook(() => useTranscription(port), {
      wrapper: queryWrapper(createTestQueryClient()),
    });
    await waitFor(() => expect(hook.result.current.settings).not.toBeNull());

    act(() => hook.result.current.selectProvider('remote'));

    await waitFor(() =>
      expect(port.updatePreferences).toHaveBeenCalledWith(
        { modelId: 'cloud-fast', providerId: 'remote' },
        expect.any(AbortSignal),
      ),
    );
  });

  it('ignores a re-selection of the model already in use', async () => {
    const port = transcriptionPort({ load: vi.fn(async () => settings()) });
    const hook = renderHook(() => useTranscription(port), {
      wrapper: queryWrapper(createTestQueryClient()),
    });
    await waitFor(() => expect(hook.result.current.settings).not.toBeNull());

    act(() => hook.result.current.selectModel('base'));

    expect(port.updatePreferences).not.toHaveBeenCalled();
  });
});
