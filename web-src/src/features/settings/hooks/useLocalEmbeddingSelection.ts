import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errorMessage, type EmbedderState } from '@/common/api/api';

export function useLocalEmbeddingSelection(onSelected: (state: EmbedderState) => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const select = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const state = await api.useEmbeddingSource('local');
      if (mounted.current) onSelected(state);
    } catch (caughtError: unknown) {
      if (mounted.current) setError(errorMessage(caughtError));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [onSelected]);

  return { busy, error, select };
}
