import { FileText, LoaderCircle, LockKeyhole, RefreshCw, TriangleAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { DocumentRuntime } from '@/features/documents/application/document-runtime';
import {
  DocumentSourceError,
  type DocumentSourceApi,
} from '@/features/documents/application/ports';
import { sourceName } from '@/features/documents/domain/document';
import { useDocumentSource } from '@/features/documents/hooks/use-document-source';

export interface DocumentSourceProps {
  api: DocumentSourceApi;
  runtime: DocumentRuntime;
}

function PendingSource({ name }: { name: string }) {
  return (
    <div
      className="flex min-h-0 flex-1 items-center justify-center gap-2 text-caption text-muted-foreground"
      role="status"
    >
      <LoaderCircle aria-hidden="true" className="size-4 motion-safe:animate-spin" />
      Loading {name}
    </div>
  );
}

function FailedSource({ error, name, retry }: { error: unknown; name: string; retry: () => void }) {
  const unsupported = error instanceof DocumentSourceError && error.kind === 'unsupported-encoding';
  const message =
    error instanceof DocumentSourceError
      ? error.message
      : 'The document could not be loaded. Your source file has not been changed.';

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-8 text-center">
      <div className="max-w-md">
        <TriangleAlert aria-hidden="true" className="mx-auto size-8 text-muted-foreground" />
        <h2 className="mt-3 text-body font-medium">
          {unsupported ? 'Unsupported text encoding' : `Could not open ${name}`}
        </h2>
        <p className="mt-1 text-caption leading-relaxed text-muted-foreground" role="alert">
          {message}
        </p>
        <Button
          className="mt-4"
          leadingIcon={RefreshCw}
          onClick={retry}
          size="sm"
          variant="tertiary"
        >
          Retry
        </Button>
      </div>
    </div>
  );
}

export function DocumentSource({ api, runtime }: DocumentSourceProps) {
  const name = sourceName(runtime.scope.source);
  const { access, format, source } = useDocumentSource(runtime, api);

  if (format === null) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <FileText aria-hidden="true" className="size-8 text-muted-foreground" />
        <div className="max-w-full min-w-0">
          <p className="truncate text-body font-medium">{name}</p>
          <p className="mt-1 text-caption text-muted-foreground">
            This document viewer is not available yet.
          </p>
        </div>
      </div>
    );
  }

  if (source.isPending) return <PendingSource name={name} />;
  if (!source.data) {
    return <FailedSource error={source.error} name={name} retry={() => void source.refetch()} />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-document-access={access}>
      {access === 'read-only' && (
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2 text-caption text-muted-foreground">
          <LockKeyhole aria-hidden="true" className="size-3.5" />
          Read-only source from another library folder
        </div>
      )}
      {source.isFetching && (
        <span className="sr-only" role="status">
          Refreshing {name}
        </span>
      )}
      {source.isError && (
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-2 text-caption">
          <span className="text-destructive">Refresh failed. Showing the last loaded source.</span>
          <Button onClick={() => void source.refetch()} size="sm" variant="tertiary">
            Retry
          </Button>
        </div>
      )}
      <ScrollArea className="min-h-0 flex-1" orientation="both">
        <pre
          aria-label={`${name} source`}
          className="min-h-full w-max min-w-full p-5 font-mono text-body leading-relaxed whitespace-pre"
        >
          {source.data.content}
        </pre>
      </ScrollArea>
    </div>
  );
}
