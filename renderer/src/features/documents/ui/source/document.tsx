import { Suspense, useEffect, type ReactNode } from 'react';

import type { DocumentRuntime } from '@/features/documents/application/document-runtime';
import { sourceName } from '@/features/documents/domain/document';
import { documentViewerFormat } from '@/features/documents/domain/document-format';

import { documentViewerEntry } from './registry';
import type { DocumentViewerRegistry, DocumentViewerServices } from './viewer';

export interface DocumentSourceProps extends DocumentViewerServices {
  active: boolean;
  runtime: DocumentRuntime;
  /** Overridable so a test can register a viewer of its own. */
  viewers?: DocumentViewerRegistry | undefined;
}

/** Routes one open document to the viewer its format registers. */
export function DocumentSource({ active, runtime, viewers, ...services }: DocumentSourceProps) {
  const name = sourceName(runtime.scope.source);
  const format = documentViewerFormat(runtime.scope.source.path);
  const entry = documentViewerEntry(format, viewers);
  const Viewer = entry.component;
  const status: typeof entry.status = (value) => (
    <OutlineStatus
      failed={!!value.error}
      active={active}
      runtime={runtime}
      navigation={services.navigation}
    >
      {entry.status(value)}
    </OutlineStatus>
  );

  return (
    <Suspense fallback={status({ name })}>
      <Viewer
        {...services}
        active={active}
        format={format}
        name={name}
        runtime={runtime}
        status={status}
      />
    </Suspense>
  );
}

function OutlineStatus({
  failed,
  active,
  runtime,
  navigation,
  children,
}: {
  failed: boolean;
  active: boolean;
  runtime: DocumentRuntime;
  navigation: DocumentViewerServices['navigation'];
  children: ReactNode;
}) {
  useEffect(() => {
    if (active) navigation.setOutlineFailed(runtime.scope.id, failed);
  }, [active, failed, navigation, runtime]);
  return children;
}
