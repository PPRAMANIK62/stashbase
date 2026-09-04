import { LoaderCircle } from 'lucide-react';
import { lazy, Suspense } from 'react';

import type { DocumentRuntime } from '@/features/documents/application/document-runtime';
import type { DocumentNavigationRuntime } from '@/features/documents/application/navigation-runtime';
import type {
  DocumentAssetApi,
  DocumentSourceApi,
  DocxPreviewApi,
  GenericFilePreviewApi,
} from '@/features/documents/application/ports';
import { sourceName } from '@/features/documents/domain/document';
import { documentViewerFormat } from '@/features/documents/domain/document-format';
import type { SourceReference } from '@/shared/domain/source-reference';

import { AssetDocument } from './asset';

const GenericFileDocument = lazy(async () => {
  const module = await import('@/features/documents/ui/generic/document');
  return { default: module.GenericFileDocument };
});

const TextDocument = lazy(async () => {
  const module = await import('./text');
  return { default: module.TextDocument };
});

export interface DocumentSourceProps {
  active: boolean;
  assetApi: DocumentAssetApi;
  docxPreviewApi: DocxPreviewApi;
  genericPreviewApi: GenericFilePreviewApi;
  navigation: DocumentNavigationRuntime;
  onNavigate(target: { anchor?: string; source: SourceReference }): void;
  onOpenExternal(href: string): Promise<boolean>;
  onReveal(source: SourceReference, signal: AbortSignal): Promise<void>;
  revealLabel: string;
  runtime: DocumentRuntime;
  sourceApi: DocumentSourceApi;
}

function PendingDocument({ name }: { name: string }) {
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

export function DocumentSource({
  active,
  assetApi,
  docxPreviewApi,
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
  const format = documentViewerFormat(runtime.scope.source.path);

  if (format === 'docx' || format === 'html' || format === 'image' || format === 'pdf') {
    return (
      <AssetDocument
        active={active}
        api={assetApi}
        docxPreviewApi={docxPreviewApi}
        format={format}
        name={name}
        navigation={navigation}
        onNavigate={onNavigate}
        onOpenExternal={onOpenExternal}
        runtime={runtime}
      />
    );
  }

  if (format === null) {
    return (
      <Suspense fallback={<PendingDocument name={name} />}>
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

  return (
    <Suspense fallback={<PendingDocument name={name} />}>
      <TextDocument
        active={active}
        format={format}
        name={name}
        navigation={navigation}
        onNavigate={onNavigate}
        onOpenExternal={onOpenExternal}
        runtime={runtime}
        sourceApi={sourceApi}
      />
    </Suspense>
  );
}
