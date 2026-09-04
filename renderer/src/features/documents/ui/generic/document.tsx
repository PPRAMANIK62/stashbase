import { useQuery } from '@tanstack/react-query';
import { FileQuestion, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import type { DocumentRuntime } from '@/features/documents/application/document-runtime';
import type { DocumentNavigationRuntime } from '@/features/documents/application/navigation-runtime';
import {
  GenericFilePreviewError,
  type GenericFilePreviewApi,
} from '@/features/documents/application/ports';
import { genericFilePreviewQuery } from '@/features/documents/application/queries';
import { CodeEditorDocument } from '@/features/documents/ui/code-editor/document';
import type { SourceReference } from '@/shared/domain/source-reference';

import { formatFileSize, genericPreviewCopy } from './presentation';

export interface GenericFileDocumentProps {
  active: boolean;
  api: GenericFilePreviewApi;
  navigation: DocumentNavigationRuntime;
  onReveal(source: SourceReference, signal: AbortSignal): Promise<void>;
  revealLabel: string;
  runtime: DocumentRuntime;
}

export function GenericFileDocument({
  active,
  api,
  navigation,
  onReveal,
  revealLabel,
  runtime,
}: GenericFileDocumentProps) {
  const preview = useQuery(genericFilePreviewQuery(api, runtime.scope));
  const revealController = useRef<AbortController | null>(null);
  const [revealState, setRevealState] = useState<'error' | 'idle' | 'pending'>('idle');
  const name = runtime.scope.source.path.split('/').at(-1) ?? runtime.scope.source.path;

  useEffect(
    () => () => {
      revealController.current?.abort();
    },
    [],
  );

  const reveal = async () => {
    revealController.current?.abort();
    const controller = new AbortController();
    revealController.current = controller;
    setRevealState('pending');
    try {
      await onReveal(runtime.scope.source, controller.signal);
      if (!controller.signal.aborted) setRevealState('idle');
    } catch {
      if (!controller.signal.aborted) setRevealState('error');
    }
  };

  if (preview.isPending) {
    return (
      <div
        className="flex min-h-0 flex-1 items-center justify-center text-caption text-muted-foreground"
        role="status"
      >
        Inspecting {name}
      </div>
    );
  }

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
              ? 'This document viewer is not available yet.'
              : preview.error instanceof Error
                ? preview.error.message
                : 'The file could not be inspected. It has not been changed.'}
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
          {revealState === 'error' && (
            <p className="mt-2 text-caption text-destructive" role="alert">
              The file could not be shown in the system file manager.
            </p>
          )}
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
        {revealState === 'error' && (
          <p className="mt-2 text-caption text-destructive" role="alert">
            The file could not be shown in the system file manager.
          </p>
        )}
      </div>
    </div>
  );
}
