import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import type {
  TranscriptionPort,
  TranscriptionSettings,
} from '@/features/settings/application/ports';
import { useTranscription } from '@/features/settings/hooks/use-transcription';

import { TranscriptionPanel } from './transcription-panel';

afterEach(cleanup);

const settings: TranscriptionSettings = {
  language: 'auto',
  modelId: 'base',
  providerId: 'local',
  providers: [
    {
      description: 'Runs on this machine.',
      id: 'local',
      kind: 'local',
      label: 'Local (whisper.cpp)',
      models: [
        {
          available: true,
          id: 'tiny',
          label: 'Tiny',
          management: 'local-download',
          sizeBytes: 75 * 1024 * 1024,
        },
        {
          available: false,
          id: 'base',
          label: 'Base',
          management: 'local-download',
          sizeBytes: 150 * 1024 * 1024,
        },
        {
          available: false,
          id: 'small',
          label: 'Small',
          management: 'local-download',
          operation: { error: 'network', status: 'failed' },
        },
      ],
    },
  ],
};

function renderPanel(port: TranscriptionPort) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper() {
    const transcription = useTranscription(port);
    return createElement(TranscriptionPanel, { transcription });
  }
  return render(
    createElement(QueryClientProvider, { client: queryClient }, createElement(Wrapper)),
  );
}

describe('TranscriptionPanel', () => {
  it('lists models with download, retry, and remove actions and starts a download', async () => {
    const port: TranscriptionPort = {
      downloadModel: vi.fn(async () => ({
        receivedBytes: 0,
        status: 'downloading' as const,
        totalBytes: 1,
      })),
      load: vi.fn(async () => settings),
      removeModel: vi.fn(async () => undefined),
      updatePreferences: vi.fn(async () => ({
        language: 'auto',
        modelId: 'base',
        providerId: 'local',
      })),
    };
    renderPanel(port);
    expect(await screen.findByText('Runs on this machine.')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Remove' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Retry download' })).not.toBeNull();
    expect(screen.getByText('Download failed: network')).not.toBeNull();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Download' }));
    await waitFor(() =>
      expect(port.downloadModel).toHaveBeenCalledWith('base', expect.any(AbortSignal)),
    );
  });

  it('reports a missing engine as an alert row and keeps the settings usable', async () => {
    const port: TranscriptionPort = {
      downloadModel: vi.fn(),
      load: vi.fn(async () => ({
        ...settings,
        providers: [
          { ...settings.providers[0], runtimeError: 'whisper-cli is missing; run the build.' },
        ],
      })),
      removeModel: vi.fn(),
      updatePreferences: vi.fn(),
    };
    renderPanel(port);
    const notice = await screen.findByRole('alert');
    expect(notice.textContent).toContain('Transcription engine unavailable');
    expect(notice.textContent).toContain('whisper-cli is missing; run the build.');
    expect(screen.getByRole('button', { name: 'Download' })).not.toBeNull();
  });

  it('presents models as choice rows and selects a model by clicking its row', async () => {
    const port: TranscriptionPort = {
      downloadModel: vi.fn(),
      load: vi.fn(async () => settings),
      removeModel: vi.fn(),
      updatePreferences: vi.fn(async () => ({
        language: 'auto',
        modelId: 'tiny',
        providerId: 'local',
      })),
    };
    renderPanel(port);
    const group = await screen.findByRole('radiogroup', { name: 'Transcription model' });
    const rows = within(group).getAllByRole('radio');
    expect(rows.map((row) => row.getAttribute('aria-label'))).toEqual(['Tiny', 'Base', 'Small']);
    expect(within(group).getByRole('radio', { name: 'Base' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(
      within(within(group).getByRole('radio', { name: 'Tiny' })).getByText('Installed'),
    ).not.toBeNull();
    expect(screen.getByText('1 of 3 installed')).not.toBeNull();

    await userEvent.setup().click(within(group).getByRole('radio', { name: 'Tiny' }));
    await waitFor(() =>
      expect(port.updatePreferences).toHaveBeenCalledWith(
        { modelId: 'tiny', providerId: 'local' },
        expect.any(AbortSignal),
      ),
    );
  });

  it('keeps a rejected preference visible', async () => {
    const port: TranscriptionPort = {
      downloadModel: vi.fn(),
      load: vi.fn(async () => settings),
      removeModel: vi.fn(async () => {
        throw new Error('The model could not be removed.');
      }),
      updatePreferences: vi.fn(),
    };
    renderPanel(port);
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Remove' }));
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'The model could not be removed.',
    );
  });
});
