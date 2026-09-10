import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useStore } from 'zustand';

import type { DocumentRuntime } from '@/features/documents/application/document-runtime';
import type { DocumentSourcePort } from '@/features/documents/application/ports';
import { documentSourceQuery } from '@/features/documents/application/queries';
import {
  isDocumentDirty,
  type DocumentConflictResolution,
} from '@/features/documents/domain/document';

const AUTOSAVE_DELAY_MS = 500;

export function useDocumentSource(
  runtime: DocumentRuntime,
  api: DocumentSourcePort,
  active: boolean,
) {
  const access = useStore(runtime.store, (state) => state.access);
  const editor = useStore(runtime.store, (state) => state.editor);
  const markdownMode = useStore(runtime.store, (state) => state.markdownMode);
  const source = useQuery(documentSourceQuery(api, runtime.scope));
  const { isFetching, isPending, refetch } = source;
  const wasActive = useRef(false);
  const dirty = editor !== null && isDocumentDirty(editor);
  const conflicted = editor?.save.kind === 'conflict';

  useEffect(() => {
    if (source.data) runtime.reconcile(source.data);
  }, [runtime, source.data]);

  useEffect(() => {
    const becameActive = active && !wasActive.current;
    wasActive.current = active;
    if (!becameActive || isPending || isFetching || dirty) return;
    void refetch();
  }, [active, dirty, isFetching, isPending, refetch]);

  useEffect(() => {
    if (!dirty || conflicted) return;
    const timeout = setTimeout(() => {
      void runtime.save(api);
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [api, conflicted, dirty, editor?.revision, runtime]);

  return {
    access,
    change: runtime.change,
    editor,
    markdownMode,
    resolveConflict: (resolution: DocumentConflictResolution) =>
      runtime.resolveConflict(api, resolution),
    retrySave: () => runtime.save(api),
    source,
  };
}
