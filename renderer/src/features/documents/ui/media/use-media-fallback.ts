import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import type { DocumentRuntime } from '@/features/documents/application/document-runtime';
import type { MediaPort, MediaDocumentAsset } from '@/features/documents/application/ports';
import { mediaPreviewStatusQuery } from '@/features/documents/application/queries';
import { useRequestSignals } from '@/shared/runtime/use-request-signals';

type PlaybackState =
  | { mode: 'direct' }
  | { mode: 'preparing' }
  | { mode: 'fallback' }
  | { message: string; mode: 'error' };

export function useMediaFallback(
  api: MediaPort,
  resource: MediaDocumentAsset,
  runtime: DocumentRuntime,
) {
  const [state, setState] = useState<PlaybackState>({ mode: 'direct' });
  const signalFor = useRequestSignals<'prepare'>();
  const preparing = state.mode === 'preparing';
  const status = useQuery({
    ...mediaPreviewStatusQuery(api, runtime.scope, resource.version),
    enabled: preparing,
    refetchInterval: preparing ? 500 : false,
  });

  const prepare = async () => {
    const signal = signalFor('prepare');
    setState({ mode: 'preparing' });
    try {
      await api.preparePreview(runtime.scope.source, signal);
      if (!signal.aborted) setState({ mode: 'fallback' });
    } catch {
      if (!signal.aborted) {
        setState({
          message: 'A compatible playback preview could not be created.',
          mode: 'error',
        });
      }
    }
  };

  return {
    cancel() {
      // Taking the lane aborts whatever holds it; the fresh signal is
      // released with the component.
      signalFor('prepare');
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
