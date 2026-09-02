import { useQuery } from '@tanstack/react-query';
import { useStore } from 'zustand';

import type { DocumentRuntime } from '@/features/documents/application/document-runtime';
import type { DocumentSourceApi } from '@/features/documents/application/ports';
import { documentSourceQuery } from '@/features/documents/application/queries';
import { documentTextFormat } from '@/features/documents/domain/document';

export function useDocumentSource(runtime: DocumentRuntime, api: DocumentSourceApi) {
  const access = useStore(runtime.store, (state) => state.access);
  const format = documentTextFormat(runtime.scope.source.path);
  const source = useQuery({
    ...documentSourceQuery(api, runtime.scope),
    enabled: format !== null,
  });

  return { access, format, source };
}
