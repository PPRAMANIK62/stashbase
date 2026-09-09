import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { createDocumentRuntime } from '@/features/documents/application/document-runtime';
import { createDocumentNavigationRuntime } from '@/features/documents/application/navigation-runtime';
import type { MediaPort, MediaDocumentAsset } from '@/features/documents/application/ports';
import { documentQueryScope, mediaApi } from '@/test/fakes/documents';
import { createTestQueryClient, withQueryClient } from '@/test/query';

import { MediaDocument } from './document';

const resource: MediaDocumentAsset = {
  fallbackUrl: 'http://127.0.0.1/asset-audio-preview/interview.webm?v=one',
  kind: 'media',
  url: 'http://127.0.0.1/asset/interview.mp4?v=one',
  version: 'one',
};

const readyState = {
  status: 'ready' as const,
  transcript: {
    durationMs: 65_000,
    language: 'en',
    model: 'small',
    segments: [
      { endMs: 2_500, id: 0, startMs: 1_000, text: 'First result' },
      { endMs: 5_000, id: 1, startMs: 2_500, text: 'Second result' },
    ],
  },
};

/** The toolkit media port, defaulted to this file's unprepared preview and
 *  ready transcript. */
function readyMediaApi(overrides: Partial<MediaPort> = {}): MediaPort {
  return mediaApi({
    loadPreviewStatus: vi.fn(async () => ({ status: 'idle' as const })),
    loadTranscript: vi.fn(async () => readyState),
    ...overrides,
  });
}

function renderMedia(path: string, api = readyMediaApi(), strict = false) {
  const runtime = createDocumentRuntime({
    activeFolderPath: '/library',
    generation: 1,
    id: 'tab-1',
    queries: documentQueryScope(),
    source: { folderPath: '/library', path },
  });
  const navigation = createDocumentNavigationRuntime('tab-1');
  const client = createTestQueryClient();
  const rendered = withQueryClient(
    <MediaDocument
      active
      api={api}
      name={path.split('/').at(-1) ?? path}
      navigation={navigation}
      resource={resource}
      runtime={runtime}
    />,
    client,
    { strict },
  );
  return { ...rendered, api, navigation, runtime };
}

// happy-dom parses media elements but never plays them, and these tests assert
// on the transport calls a seek makes.
beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(async () => undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
});

describe('media document', () => {
  it('retains its playback source through Strict Mode ref replay', async () => {
    const rendered = renderMedia('recordings/interview.mp3', readyMediaApi(), true);
    const audio = screen.getByLabelText('interview.mp3 playback');

    expect(audio.getAttribute('src')).toBe(resource.url);
    rendered.runtime.dispose();
    rendered.navigation.dispose();
    rendered.client.clear();
  });

  it('plays audio with native controls and seeks through synchronized transcript rows', async () => {
    const rendered = renderMedia('recordings/interview.mp3');
    const audio = screen.getByLabelText<HTMLAudioElement>('interview.mp3 playback');
    expect(audio.controls).toBe(true);
    expect(audio.src).toBe(resource.url);
    expect(await screen.findByRole('heading', { name: 'Transcript' })).not.toBeNull();
    expect(await screen.findByText('en · small · 1:05')).not.toBeNull();

    await userEvent.setup().click(screen.getByRole('button', { name: /0:01 First result/u }));
    expect(audio.currentTime).toBe(1);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: /0:01 First result/u }).getAttribute('aria-current'),
    ).toBe('true');

    await waitFor(() => expect(rendered.navigation.store.getState().find.available).toBe(true));
    rendered.navigation.setFindQuery('Second');
    await waitFor(() => expect(audio.currentTime).toBe(2.5));
    rendered.runtime.dispose();
    rendered.navigation.dispose();
    rendered.client.clear();
  });

  it('shows direct video and preserves its time when falling back to compatible audio', async () => {
    const api = readyMediaApi();
    const rendered = renderMedia('recordings/interview.mp4', api);
    const video = screen.getByLabelText<HTMLVideoElement>('interview.mp4 playback');
    expect(video.tagName).toBe('VIDEO');
    video.currentTime = 12;
    fireEvent.timeUpdate(video);
    fireEvent.error(video);

    expect(await screen.findByText('Preparing a compatible preview…')).not.toBeNull();
    const audio = await screen.findByLabelText<HTMLAudioElement>('interview.mp4 playback');
    fireEvent.loadedMetadata(audio);
    expect(audio.tagName).toBe('AUDIO');
    expect(audio.src).toBe(resource.fallbackUrl);
    expect(audio.currentTime).toBe(12);
    expect(
      screen.getByText('Video playback is unavailable. Playing its audio track instead.'),
    ).not.toBeNull();
    expect(api.preparePreview).toHaveBeenCalledWith(
      { folderPath: '/library', path: 'recordings/interview.mp4' },
      expect.any(AbortSignal),
    );
    rendered.runtime.dispose();
    rendered.navigation.dispose();
    rendered.client.clear();
  });

  it('aborts compatible-preview work when the viewer is removed', async () => {
    const preparationSignal: { current?: AbortSignal } = {};
    const api = readyMediaApi({
      preparePreview: vi.fn((_source, signal) => {
        preparationSignal.current = signal;
        return new Promise<void>(() => undefined);
      }),
    });
    const rendered = renderMedia('recordings/interview.wav', api);
    fireEvent.error(screen.getByLabelText('interview.wav playback'));
    await screen.findByText('Preparing a compatible preview…');

    rendered.unmount();
    expect(preparationSignal.current?.aborted).toBe(true);
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
    expect(HTMLMediaElement.prototype.load).toHaveBeenCalled();
    rendered.runtime.dispose();
    rendered.navigation.dispose();
    rendered.client.clear();
  });

  it('restarts a failed transcript independently from healthy playback', async () => {
    const loadTranscript = vi
      .fn<MediaPort['loadTranscript']>()
      .mockResolvedValueOnce({ status: 'failed' })
      .mockResolvedValueOnce(readyState);
    const api = readyMediaApi({ loadTranscript });
    const rendered = renderMedia('recordings/interview.m4a', api);

    expect(await screen.findByText('Transcript preparation failed.')).not.toBeNull();
    expect(screen.getByLabelText('interview.m4a playback')).not.toBeNull();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('First result')).not.toBeNull();
    expect(api.reprocessTranscript).toHaveBeenCalledWith(
      { folderPath: '/library', path: 'recordings/interview.m4a' },
      expect.any(AbortSignal),
    );
    rendered.runtime.dispose();
    rendered.navigation.dispose();
    rendered.client.clear();
  });
});
