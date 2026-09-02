import {
  AlertCircle,
  FileText,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  TriangleAlert,
} from 'lucide-react';

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

function SaveFeedback({
  editor,
  retry,
}: {
  editor: NonNullable<ReturnType<typeof useDocumentSource>['editor']>;
  retry: () => void;
}) {
  if (
    editor.savePhase !== 'conflict' &&
    editor.savePhase !== 'error' &&
    editor.savePhase !== 'warning'
  ) {
    return null;
  }
  const failed = editor.savePhase === 'conflict' || editor.savePhase === 'error';
  const text =
    editor.savePhase === 'conflict'
      ? 'Conflict detected'
      : editor.savePhase === 'error'
        ? (editor.saveMessage ?? 'Save failed')
        : (editor.saveMessage ?? 'Saved with a warning');

  return (
    <div
      className="absolute right-4 bottom-3 flex max-w-[min(32rem,calc(100%-2rem))] items-center gap-2 rounded-md border border-border bg-surface-2/95 px-2.5 py-1.5 text-caption shadow-sm"
      data-save-phase={editor.savePhase}
    >
      {failed ? (
        <AlertCircle aria-hidden="true" className="size-3.5 shrink-0 text-destructive" />
      ) : (
        <TriangleAlert aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
      )}
      <span
        className={
          failed ? 'min-w-0 truncate text-destructive' : 'min-w-0 truncate text-muted-foreground'
        }
        role={failed ? 'alert' : 'status'}
        title={text}
      >
        {text}
      </span>
      {editor.savePhase === 'error' && (
        <Button onClick={retry} size="sm" variant="tertiary">
          Retry
        </Button>
      )}
    </div>
  );
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
  const { access, change, editor, format, retrySave, source } = useDocumentSource(runtime, api);

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

  if (access === 'editable' && !editor) return <PendingSource name={name} />;

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
      {access === 'editable' && editor ? (
        <div className="relative min-h-0 flex-1">
          <textarea
            aria-label={`${name} source`}
            className="size-full resize-none border-0 bg-transparent p-5 pb-12 font-mono text-body leading-relaxed whitespace-pre outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset"
            data-document-dirty={editor.dirty || undefined}
            onChange={(event) => change(event.currentTarget.value)}
            spellCheck={false}
            value={editor.value}
            wrap="off"
          />
          <SaveFeedback editor={editor} retry={() => void retrySave()} />
        </div>
      ) : (
        <ScrollArea className="min-h-0 flex-1" orientation="both">
          <pre
            aria-label={`${name} source`}
            className="min-h-full w-max min-w-full p-5 font-mono text-body leading-relaxed whitespace-pre"
          >
            {source.data.content}
          </pre>
        </ScrollArea>
      )}
    </div>
  );
}
