/**
 * The frame every editable text format shares: load the versioned source,
 * surface a refresh that failed, hand a conflict to the comparison view, and
 * report the save outcome. The format-specific editor is the child, so
 * Markdown, JSON, and plain text differ only in what they render inside.
 */
import { AlertCircle, LockKeyhole, TriangleAlert } from 'lucide-react';
import { lazy, Suspense, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import type { DocumentRuntime } from '@/features/documents/application/document-runtime';
import {
  documentFailure,
  DOCUMENT_SOURCE_MESSAGES,
} from '@/features/documents/application/failure-messages';
import type { DocumentSourcePort } from '@/features/documents/application/ports';
import {
  documentSaveMessage,
  type DocumentAccess,
  type DocumentEditorState,
  type DocumentSaveState,
} from '@/features/documents/domain/document';
import { useDocumentSource } from '@/features/documents/hooks/use-document-source';

import { DocumentFailure, DocumentPending } from './status';
import type { DocumentViewerStatus } from './viewer';

const DocumentConflict = lazy(async () => {
  const module = await import('./conflict');
  return { default: module.DocumentConflict };
});

/** What the format-specific editor is handed once the source has landed. */
interface TextSurfaceSlot {
  access: DocumentAccess;
  editor: DocumentEditorState | null;
  markdownMode: 'reading' | 'writer';
  onChange(value: string): void;
  readOnly: boolean;
  value: string;
}

export interface TextSurfaceProps {
  active: boolean;
  children(slot: TextSurfaceSlot): ReactNode;
  editorLabel: string;
  name: string;
  runtime: DocumentRuntime;
  sourceApi: DocumentSourcePort;
  status(status: DocumentViewerStatus): ReactNode;
}

function SaveFeedback({ retry, save }: { retry: () => void; save: DocumentSaveState }) {
  if (save.kind !== 'failed' && save.kind !== 'warned') return null;
  const failed = save.kind === 'failed';
  const text = documentSaveMessage(save) ?? '';

  return (
    <div
      className="absolute right-4 bottom-3 flex max-w-[min(32rem,calc(100%-2rem))] items-center gap-2 rounded-md border border-border bg-surface-2/95 px-2.5 py-1.5 text-caption shadow-sm"
      data-save-state={save.kind}
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
      {failed && (
        <Button onClick={retry} size="compact" variant="tertiary">
          Retry
        </Button>
      )}
    </div>
  );
}

export function TextSurface({
  active,
  children,
  editorLabel,
  name,
  runtime,
  sourceApi,
  status,
}: TextSurfaceProps) {
  const { access, change, editor, markdownMode, resolveConflict, retrySave, source } =
    useDocumentSource(runtime, sourceApi, active);

  if (source.isPending) return <>{status({ name })}</>;
  if (!source.data) {
    return (
      <DocumentFailure
        message={
          documentFailure(source.error, 'DocumentSourceError', DOCUMENT_SOURCE_MESSAGES).message
        }
        name={name}
        retry={() => void source.refetch()}
      />
    );
  }
  if (access === 'editable' && !editor) return <>{status({ name })}</>;

  const conflict = editor?.save.kind === 'conflict' ? editor.save.conflict : null;
  if (access === 'editable' && conflict) {
    return (
      <Suspense fallback={<DocumentPending label="Loading conflict comparison" />}>
        <DocumentConflict conflict={conflict} name={name} resolve={resolveConflict} />
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
          <Button onClick={() => void source.refetch()} size="compact" variant="tertiary">
            Retry
          </Button>
        </div>
      )}
      <div className="relative min-h-0 flex-1">
        <Suspense fallback={<DocumentPending label={`Loading ${editorLabel}`} />}>
          {children({
            access,
            editor,
            markdownMode,
            onChange: change,
            readOnly: access === 'read-only' || editor === null,
            value: editor?.value ?? source.data.content,
          })}
        </Suspense>
        {access === 'editable' && editor && (
          <SaveFeedback retry={() => void retrySave()} save={editor.save} />
        )}
      </div>
    </div>
  );
}
