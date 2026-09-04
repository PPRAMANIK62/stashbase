import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { createDocumentRuntime } from '@/features/documents/application/document-runtime';
import { createDocumentNavigationRuntime } from '@/features/documents/application/navigation-runtime';
import type { MediaApi, MediaDocumentAsset } from '@/features/documents/application/ports';

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

function mediaApi(overrides: Partial<MediaApi> = {}): MediaApi {
  return {
    cancelTranscript: vi.fn(async () => true),
    loadPreviewStatus: vi.fn(async () => ({ status: 'idle' as const })),
    loadTranscript: vi.fn(async () => readyState),
    preparePreview: vi.fn(async () => undefined),
    reprocessTranscript: vi.fn(async () => undefined),
    ...overrides,
  };
}

function renderMedia(path: string, api = mediaApi(), strict = false) {
  const runtime = createDocumentRuntime({
    activeFolderPath: '/library',
    generation: 1,
    id: 'tab-1',
    queries: {
      cancel: vi.fn(async () => undefined),
      remove: vi.fn(),
      replaceSource: vi.fn(),
    },
    source: { folderPath: '/library', path },
  });
  const navigation = createDocumentNavigationRuntime('tab-1');
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const document = (
    <QueryClientProvider client={client}>
      <MediaDocument
        active
        api={api}
        name={path.split('/').at(-1) ?? path}
        navigation={navigation}
        resource={resource}
        runtime={runtime}
      />
    </QueryClientProvider>
  );
  const rendered = render(strict ? <StrictMode>{document}</StrictMode> : document);
  return { ...rendered, api, client, navigation, runtime };
}

let playDescriptor: PropertyDescriptor | undefined;
let pauseDescriptor: PropertyDescriptor | undefined;
let loadDescriptor: PropertyDescriptor | undefined;
let getAnimationsDescriptor: PropertyDescriptor | undefined;

beforeEach(() => {
  getAnimationsDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'getAnimations');
  Object.defineProperty(Element.prototype, 'getAnimations', {
    configurable: true,
    value: vi.fn(() => []),
  });
  playDescriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'play');
  pauseDescriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'pause');
  loadDescriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'load');
  Object.defineProperty(HTMLMediaElement.prototype, 'play', {
    configurable: true,
    value: vi.fn(async () => undefined),
  });
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(HTMLMediaElement.prototype, 'load', {
    configurable: true,
    value: vi.fn(),
  });
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      addEventListener: vi.fn(),
      matches: false,
      media: '',
      removeEventListener: vi.fn(),
    })),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  if (playDescriptor) {
    Object.defineProperty(HTMLMediaElement.prototype, 'play', playDescriptor);
  }
  playDescriptor = undefined;
  if (pauseDescriptor) {
    Object.defineProperty(HTMLMediaElement.prototype, 'pause', pauseDescriptor);
  }
  if (loadDescriptor) {
    Object.defineProperty(HTMLMediaElement.prototype, 'load', loadDescriptor);
  }
  pauseDescriptor = undefined;
  loadDescriptor = undefined;
  if (getAnimationsDescriptor) {
    Object.defineProperty(Element.prototype, 'getAnimations', getAnimationsDescriptor);
  } else {
    Reflect.deleteProperty(Element.prototype, 'getAnimations');
  }
  getAnimationsDescriptor = undefined;
});

describe('media document', () => {
  it('retains its playback source through Strict Mode ref replay', async () => {
    const rendered = renderMedia('recordings/interview.mp3', mediaApi(), true);
    const audio = screen.getByLabelText('interview.mp3 playback');

    expect(audio.getAttribute('src')).toBe(resource.url);
    rendered.runtime.dispose();
    rendered.navigation.dispose();
    rendered.client.clear();
  });

  it('plays audio with native controls and seeks through synchronized transcript rows', async () => {
    const rendered = renderMedia('recordings/interview.mp3');
    const audio = screen.getByLabelText('interview.mp3 playback') as HTMLAudioElement;
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
    const api = mediaApi();
    const rendered = renderMedia('recordings/interview.mp4', api);
    const video = screen.getByLabelText('interview.mp4 playback') as HTMLVideoElement;
    expect(video.tagName).toBe('VIDEO');
    video.currentTime = 12;
    fireEvent.timeUpdate(video);
    fireEvent.error(video);

    expect(await screen.findByText('Preparing a compatible preview…')).not.toBeNull();
    const audio = (await screen.findByLabelText('interview.mp4 playback')) as HTMLAudioElement;
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
    const api = mediaApi({
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
      .fn<MediaApi['loadTranscript']>()
      .mockResolvedValueOnce({ status: 'failed' })
      .mockResolvedValueOnce(readyState);
    const api = mediaApi({ loadTranscript });
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
