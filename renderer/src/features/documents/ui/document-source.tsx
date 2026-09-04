import { AlertCircle, LoaderCircle, LockKeyhole, RefreshCw, TriangleAlert } from 'lucide-react';
import { lazy, Suspense } from 'react';

import { Button } from '@/components/ui/button';
import type { DocumentRuntime } from '@/features/documents/application/document-runtime';
import type { DocumentNavigationRuntime } from '@/features/documents/application/navigation-runtime';
import {
  DocumentSourceError,
  type DocumentSourceApi,
  type GenericFilePreviewApi,
} from '@/features/documents/application/ports';
import { sourceName } from '@/features/documents/domain/document';
import { useDocumentSource } from '@/features/documents/hooks/use-document-source';
import type { SourceReference } from '@/shared/domain/source-reference';

const DocumentConflict = lazy(async () => {
  const module = await import('./document-conflict');
  return { default: module.DocumentConflict };
});

const MarkdownDocument = lazy(async () => {
  const module = await import('./markdown/document');
  return { default: module.MarkdownDocument };
});

const JsonDocument = lazy(async () => {
  const module = await import('./json/document');
  return { default: module.JsonDocument };
});

const GenericFileDocument = lazy(async () => {
  const module = await import('./generic/document');
  return { default: module.GenericFileDocument };
});

const CodeEditorDocument = lazy(async () => {
  const module = await import('./code-editor/document');
  return { default: module.CodeEditorDocument };
});

export interface DocumentSourceProps {
  active: boolean;
  genericPreviewApi: GenericFilePreviewApi;
  navigation: DocumentNavigationRuntime;
  onNavigate(target: { anchor?: string; source: SourceReference }): void;
  onOpenExternal(href: string): Promise<boolean>;
  onReveal(source: SourceReference, signal: AbortSignal): Promise<void>;
  revealLabel: string;
  runtime: DocumentRuntime;
  sourceApi: DocumentSourceApi;
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

export function DocumentSource({
  active,
  genericPreviewApi,
  navigation,
  onNavigate,
  onOpenExternal,
  onReveal,
  revealLabel,
  runtime,
  sourceApi,
}: DocumentSourceProps) {
  const name = sourceName(runtime.scope.source);
  const { access, change, editor, format, markdownMode, resolveConflict, retrySave, source } =
    useDocumentSource(runtime, sourceApi, active);

  if (format === null) {
    return (
      <Suspense fallback={<PendingSource name={name} />}>
        <GenericFileDocument
          active={active}
          api={genericPreviewApi}
          navigation={navigation}
          onReveal={onReveal}
          revealLabel={revealLabel}
          runtime={runtime}
        />
      </Suspense>
    );
  }

  if (source.isPending) return <PendingSource name={name} />;
  if (!source.data) {
    return <FailedSource error={source.error} name={name} retry={() => void source.refetch()} />;
  }

  if (access === 'editable' && !editor) return <PendingSource name={name} />;

  if (access === 'editable' && editor?.conflict) {
    return (
      <Suspense fallback={<PendingSource name="conflict comparison" />}>
        <DocumentConflict editor={editor} name={name} resolve={resolveConflict} />
      </Suspense>
    );
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
      {format === 'md' ? (
        <div className="relative min-h-0 flex-1">
          <Suspense fallback={<PendingSource name="Markdown editor" />}>
            <MarkdownDocument
              active={active}
              canChangeMode={access === 'editable' && editor !== null}
              dirty={editor?.dirty ?? false}
              mode={markdownMode}
              name={name}
              onChange={change}
              onNavigate={onNavigate}
              onModeChange={(mode) => runtime.setMarkdownMode(mode)}
              onOpenExternal={onOpenExternal}
              navigation={navigation}
              readOnly={access === 'read-only' || editor === null || markdownMode === 'reading'}
              source={runtime.scope.source}
              tabId={runtime.scope.id}
              value={editor?.value ?? source.data.content}
            />
          </Suspense>
          {access === 'editable' && editor && (
            <SaveFeedback editor={editor} retry={() => void retrySave()} />
          )}
        </div>
      ) : format === 'json' ? (
        <div className="relative min-h-0 flex-1">
          <Suspense fallback={<PendingSource name="JSON editor" />}>
            <JsonDocument
              active={active}
              name={name}
              navigation={navigation}
              onChange={change}
              readOnly={access === 'read-only' || editor === null}
              runtime={runtime}
              value={editor?.value ?? source.data.content}
            />
          </Suspense>
          {access === 'editable' && editor && (
            <SaveFeedback editor={editor} retry={() => void retrySave()} />
          )}
        </div>
      ) : (
        <div className="relative min-h-0 flex-1">
          <Suspense fallback={<PendingSource name="text editor" />}>
            <CodeEditorDocument
              active={active}
              ariaLabel={`${name} source`}
              content={editor?.value ?? source.data.content}
              language={{ kind: 'plain' }}
              navigation={navigation}
              onChange={change}
              readOnly={access === 'read-only' || editor === null}
              runtime={runtime}
            />
          </Suspense>
          {access === 'editable' && editor && (
            <SaveFeedback editor={editor} retry={() => void retrySave()} />
          )}
        </div>
      )}
    </div>
  );
}
