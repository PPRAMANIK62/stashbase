import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useStore } from 'zustand';

import type { DocumentRuntime } from '@/features/documents/application/document-runtime';
import type { DocumentSourceApi } from '@/features/documents/application/ports';
import { documentSourceQuery } from '@/features/documents/application/queries';
import { documentTextFormat } from '@/features/documents/domain/document';
import type { DocumentConflictResolution } from '@/features/documents/domain/document';

const AUTOSAVE_DELAY_MS = 500;

export function useDocumentSource(runtime: DocumentRuntime, api: DocumentSourceApi) {
  const access = useStore(runtime.store, (state) => state.access);
  const editor = useStore(runtime.store, (state) => state.editor);
  const format = documentTextFormat(runtime.scope.source.path);
  const source = useQuery({
    ...documentSourceQuery(api, runtime.scope),
    enabled: format !== null,
  });

  useEffect(() => {
    if (source.data) runtime.reconcile(source.data);
  }, [runtime, source.data]);

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
    resolveConflict: (resolution: DocumentConflictResolution) =>
      runtime.resolveConflict(api, resolution),
    retrySave: () => runtime.save(api),
    source,
  };
}
