/**
 * The honest fallback viewer: a name StashBase claims no format for still
 * opens, showing either bounded read-only text or a placeholder that names
 * what the file is and offers to reveal it on disk.
 */
import { useQuery } from '@tanstack/react-query';
import { FileQuestion, RefreshCw } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import type { DocumentRuntime } from '@/features/documents/application/document-runtime';
import {
  documentFailure,
  GENERIC_PREVIEW_MESSAGES,
} from '@/features/documents/application/failure-messages';
import type { DocumentNavigationRuntime } from '@/features/documents/application/navigation-runtime';
import {
  GenericFilePreviewError,
  type GenericFilePreviewPort,
} from '@/features/documents/application/ports';
import { genericFilePreviewQuery } from '@/features/documents/application/queries';
import { CodeEditorDocument } from '@/features/documents/ui/code-editor/document';
import type { DocumentViewerStatus } from '@/features/documents/ui/source/viewer';
import type { SourceReference } from '@/shared/domain/source-reference';
import { useRequestSignals } from '@/shared/runtime/use-request-signals';

import { formatFileSize, genericPreviewCopy } from './presentation';

export interface GenericFileDocumentProps {
  active: boolean;
  api: GenericFilePreviewPort;
  navigation: DocumentNavigationRuntime;
  onReveal(source: SourceReference, signal: AbortSignal): Promise<void>;
  revealLabel: string;
  runtime: DocumentRuntime;
  status(status: DocumentViewerStatus): ReactNode;
}

export function GenericFileDocument({
  active,
  api,
  navigation,
  onReveal,
  revealLabel,
  runtime,
  status,
}: GenericFileDocumentProps) {
  const preview = useQuery(genericFilePreviewQuery(api, runtime.scope));
  const signalFor = useRequestSignals<'reveal'>();
  const [revealState, setRevealState] = useState<'error' | 'idle' | 'pending'>('idle');
  const name = runtime.scope.source.path.split('/').at(-1) ?? runtime.scope.source.path;

  const reveal = async () => {
    const signal = signalFor('reveal');
    setRevealState('pending');
    try {
      await onReveal(runtime.scope.source, signal);
      if (!signal.aborted) setRevealState('idle');
    } catch {
      if (!signal.aborted) setRevealState('error');
    }
  };

  const revealError = revealState === 'error' && (
    <p className="mt-2 text-caption text-destructive" role="alert">
      The file could not be shown in the system file manager.
    </p>
  );

  if (preview.isPending) return <>{status({ name })}</>;

  if (!preview.data) {
    const formatSpecific =
      preview.error instanceof GenericFilePreviewError && preview.error.kind === 'not-generic';
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-8 text-center">
        <div className="max-w-md">
          <FileQuestion aria-hidden="true" className="mx-auto size-4 text-muted-foreground" />
          <h2 className="mt-3 text-body font-medium">
            {formatSpecific ? name : `Could not inspect ${name}`}
          </h2>
          <p className="mt-1 text-caption leading-relaxed text-muted-foreground" role="alert">
            {formatSpecific
              ? GENERIC_PREVIEW_MESSAGES['not-generic']
              : documentFailure<'not-generic'>(
                  preview.error,
                  'GenericFilePreviewError',
                  GENERIC_PREVIEW_MESSAGES,
                ).message}
          </p>
          {!formatSpecific && (
            <div className="mt-4 flex justify-center gap-2">
              <Button
                leadingIcon={RefreshCw}
                onClick={() => void preview.refetch()}
                size="compact"
                variant="tertiary"
              >
                Retry
              </Button>
              <Button
                loading={revealState === 'pending'}
                onClick={() => void reveal()}
                size="compact"
                variant="tertiary"
              >
                {revealLabel}
              </Button>
            </div>
          )}
          {revealError}
        </div>
      </div>
    );
  }

  if (preview.data.kind === 'text') {
    return (
      <CodeEditorDocument
        active={active}
        ariaLabel={`Read-only ${name} source`}
        content={preview.data.content}
        language={{ fileName: preview.data.name, kind: 'filename' }}
        navigation={navigation}
        onChange={() => undefined}
        readOnly
        runtime={runtime}
      />
    );
  }

  const copy = genericPreviewCopy(preview.data);
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-8 text-center">
      <div className="max-w-md">
        <FileQuestion aria-hidden="true" className="mx-auto size-4 text-muted-foreground" />
        <h2 className="mt-3 text-body font-medium">{copy.title}</h2>
        <p className="mt-1 text-caption leading-relaxed text-muted-foreground" role="status">
          {copy.description}
        </p>
        <p className="mt-3 font-mono text-caption break-all text-muted-foreground">
          {preview.data.name}
          {preview.data.size === undefined ? '' : ` · ${formatFileSize(preview.data.size)}`}
        </p>
        <Button
          className="mt-4"
          loading={revealState === 'pending'}
          onClick={() => void reveal()}
          size="compact"
          variant="tertiary"
        >
          {revealLabel}
        </Button>
        {revealError}
      </div>
    </div>
  );
}
