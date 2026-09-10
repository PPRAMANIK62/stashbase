import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { failureMessage } from '@/features/settings/application/failure-messages';
import type { TranscriptionPort } from '@/features/settings/application/ports';
import {
  transcriptionModel,
  transcriptionPort,
  transcriptionProvider,
  transcriptionSettings,
} from '@/test/fakes/settings';
import { withQueryClient } from '@/test/query';

import { TranscriptionPanel } from './transcription-panel';

afterEach(cleanup);

const localProvider = transcriptionProvider({
  models: [
    transcriptionModel({
      available: true,
      id: 'tiny',
      label: 'Tiny',
      sizeBytes: 75 * 1024 * 1024,
    }),
    transcriptionModel({ id: 'base', label: 'Base', sizeBytes: 150 * 1024 * 1024 }),
    transcriptionModel({
      id: 'small',
      label: 'Small',
      operation: { error: 'network', status: 'failed' },
    }),
  ],
});

const settings = transcriptionSettings({ language: 'auto', providers: [localProvider] });

function renderPanel(port: TranscriptionPort) {
  return withQueryClient(<TranscriptionPanel transcriptionApi={port} />);
}

describe('TranscriptionPanel', () => {
  it('lists models with download, retry, and remove actions and starts a download', async () => {
    const port = transcriptionPort({
      downloadModel: vi.fn(async () => ({
        receivedBytes: 0,
        status: 'downloading' as const,
        totalBytes: 1,
      })),
      load: vi.fn(async () => settings),
      updatePreferences: vi.fn(async () => ({
        language: 'auto',
        modelId: 'base',
        providerId: 'local',
      })),
    });
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

  it('draws a bar only for the model that is actually downloading', async () => {
    const port = transcriptionPort({
      load: vi.fn(async () =>
        transcriptionSettings({
          providers: [
            transcriptionProvider({
              models: [
                transcriptionModel({
                  id: 'base',
                  label: 'Base',
                  operation: { receivedBytes: 30, status: 'downloading', totalBytes: 100 },
                }),
                transcriptionModel({
                  available: true,
                  id: 'tiny',
                  label: 'Tiny',
                  sizeBytes: 75 * 1024 * 1024,
                }),
              ],
            }),
          ],
        }),
      ),
    });
    renderPanel(port);

    const base = await screen.findByRole('radio', { name: 'Base' });
    expect(within(base).getByText('Downloading… 30%')).not.toBeNull();
    expect(within(base).queryByText('Installed')).toBeNull();
    expect(
      within(screen.getByRole('radio', { name: 'Tiny' })).getByText('Installed'),
    ).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Working…' })).not.toBeNull();
  });

  it('reports a missing engine as an alert row and keeps the settings usable', async () => {
    const port = transcriptionPort({
      load: vi.fn(async () =>
        transcriptionSettings({
          language: 'auto',
          providers: [
            transcriptionProvider({
              models: localProvider.models,
              runtimeError: 'whisper-cli is missing; run the build.',
            }),
          ],
        }),
      ),
    });
    renderPanel(port);
    const notice = await screen.findByRole('alert');
    expect(notice.textContent).toContain('Transcription engine unavailable');
    expect(notice.textContent).toContain('whisper-cli is missing; run the build.');
    expect(screen.getByRole('button', { name: 'Download' })).not.toBeNull();
  });

  it('presents models as choice rows and selects a model by clicking its row', async () => {
    const port = transcriptionPort({
      load: vi.fn(async () => settings),
      updatePreferences: vi.fn(async () => ({
        language: 'auto',
        modelId: 'tiny',
        providerId: 'local',
      })),
    });
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
    const port = transcriptionPort({
      load: vi.fn(async () => settings),
      removeModel: vi.fn(async () => {
        throw new Error('EPIPE');
      }),
    });
    renderPanel(port);
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Remove' }));
    // An unreachable server is a quiet status, not an alert about this screen.
    expect(await screen.findByRole('status')).toHaveProperty(
      'textContent',
      failureMessage('unavailable'),
    );
  });
});
