import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useStore } from 'zustand';

import type { DocumentRuntime } from '@/features/documents/application/document-runtime';
import type { DocumentSourceApi } from '@/features/documents/application/ports';
import { documentSourceQuery } from '@/features/documents/application/queries';
import { documentTextFormat } from '@/features/documents/domain/document';
import type { DocumentConflictResolution } from '@/features/documents/domain/document';

const AUTOSAVE_DELAY_MS = 500;

export function useDocumentSource(
  runtime: DocumentRuntime,
  api: DocumentSourceApi,
  active: boolean,
) {
  const access = useStore(runtime.store, (state) => state.access);
  const editor = useStore(runtime.store, (state) => state.editor);
  const markdownMode = useStore(runtime.store, (state) => state.markdownMode);
  const format = documentTextFormat(runtime.scope.source.path);
  const source = useQuery({
    ...documentSourceQuery(api, runtime.scope),
    enabled: format !== null,
  });
  const { isFetching, isPending, refetch } = source;
  const wasActive = useRef(false);

  useEffect(() => {
    if (source.data) runtime.reconcile(source.data);
  }, [runtime, source.data]);

  useEffect(() => {
    const becameActive = active && !wasActive.current;
    wasActive.current = active;
    if (!becameActive || isPending || isFetching || editor?.dirty) return;
    void refetch();
  }, [active, editor?.dirty, isFetching, isPending, refetch]);

  useEffect(() => {
    if (!editor?.dirty || editor.conflict) return;
    const timeout = setTimeout(() => {
      void runtime.save(api);
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [api, editor?.conflict, editor?.dirty, editor?.revision, runtime]);

  return {
    access,
    change: runtime.change,
    editor,
    format,
    markdownMode,
    resolveConflict: (resolution: DocumentConflictResolution) =>
      runtime.resolveConflict(api, resolution),
    retrySave: () => runtime.save(api),
    source,
  };
}
