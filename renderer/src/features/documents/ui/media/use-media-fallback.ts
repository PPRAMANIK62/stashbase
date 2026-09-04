import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import type { DocumentRuntime } from '@/features/documents/application/document-runtime';
import type { MediaApi, MediaDocumentAsset } from '@/features/documents/application/ports';
import { mediaPreviewStatusQuery } from '@/features/documents/application/queries';

type PlaybackState =
  | { mode: 'direct' }
  | { mode: 'preparing' }
  | { mode: 'fallback' }
  | { message: string; mode: 'error' };

export function useMediaFallback(
  api: MediaApi,
  resource: MediaDocumentAsset,
  runtime: DocumentRuntime,
) {
  const [state, setState] = useState<PlaybackState>({ mode: 'direct' });
  const controllerRef = useRef<AbortController | null>(null);
  const preparing = state.mode === 'preparing';
  const status = useQuery({
    ...mediaPreviewStatusQuery(api, runtime.scope, resource.version),
    enabled: preparing,
    refetchInterval: preparing ? 500 : false,
  });

  useEffect(
    () => () => {
      controllerRef.current?.abort();
    },
    [],
  );

  const prepare = async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState({ mode: 'preparing' });
    try {
      await api.preparePreview(runtime.scope.source, controller.signal);
      if (!controller.signal.aborted && controllerRef.current === controller) {
        setState({ mode: 'fallback' });
      }
    } catch {
      if (!controller.signal.aborted && controllerRef.current === controller) {
        setState({
          message: 'A compatible playback preview could not be created.',
          mode: 'error',
        });
      }
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  };

  return {
    cancel() {
      controllerRef.current?.abort();
      controllerRef.current = null;
      setState({ message: 'Compatible preview generation was cancelled.', mode: 'error' });
    },
    error: state.mode === 'error' ? state.message : null,
    markUnplayable() {
      if (state.mode === 'direct') {
        void prepare();
      } else if (state.mode === 'fallback') {
        setState({ message: 'This media file could not be played.', mode: 'error' });
      }
    },
    playbackUrl: state.mode === 'fallback' ? resource.fallbackUrl : resource.url,
    prepare,
    preparing,
    status: status.data,
    usingFallback: state.mode === 'fallback',
  };
}
