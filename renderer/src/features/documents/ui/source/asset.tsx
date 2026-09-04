import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { lazy, Suspense } from 'react';

import { Button } from '@/components/ui/button';
import type { DocumentRuntime } from '@/features/documents/application/document-runtime';
import type { DocumentNavigationRuntime } from '@/features/documents/application/navigation-runtime';
import type {
  DocumentAssetApi,
  DocxPreviewApi,
  MediaApi,
} from '@/features/documents/application/ports';
import { documentAssetQuery } from '@/features/documents/application/queries';
import type { DocumentViewerFormat } from '@/features/documents/domain/document-format';
import type { SourceReference } from '@/shared/domain/source-reference';

const DocxDocument = lazy(async () => {
  const module = await import('@/features/documents/ui/docx/document');
  return { default: module.DocxDocument };
});

const HtmlDocument = lazy(async () => {
  const module = await import('@/features/documents/ui/html/document');
  return { default: module.HtmlDocument };
});

const ImageDocument = lazy(async () => {
  const module = await import('@/features/documents/ui/image/document');
  return { default: module.ImageDocument };
});

const PdfDocument = lazy(async () => {
  const module = await import('@/features/documents/ui/pdf/document');
  return { default: module.PdfDocument };
});

const MediaDocument = lazy(async () => {
  const module = await import('@/features/documents/ui/media/document');
  return { default: module.MediaDocument };
});

function AssetStatus({
  failed = false,
  name,
  retry,
}: {
  failed?: boolean;
  name: string;
  retry?: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center">
      <div>
        <p className="text-body font-medium">
          {failed ? `Could not open ${name}` : `Loading ${name}`}
        </p>
        {failed && (
          <>
            <p className="mt-1 text-caption text-muted-foreground" role="alert">
              The file may have moved, changed, or become unavailable.
            </p>
            <Button
              className="mt-4"
              leadingIcon={RefreshCw}
              onClick={retry}
              size="compact"
              variant="tertiary"
            >
              Retry
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export function AssetDocument({
  active,
  api,
  docxPreviewApi,
  format,
  mediaApi,
  name,
  navigation,
  onNavigate,
  onOpenExternal,
  runtime,
}: {
  active: boolean;
  api: DocumentAssetApi;
  docxPreviewApi: DocxPreviewApi;
  format: Exclude<DocumentViewerFormat, 'json' | 'md' | 'txt'>;
  mediaApi: MediaApi;
  name: string;
  navigation: DocumentNavigationRuntime;
  onNavigate(target: { anchor?: string; source: SourceReference }): void;
  onOpenExternal(href: string): Promise<boolean>;
  runtime: DocumentRuntime;
}) {
  const asset = useQuery({ ...documentAssetQuery(api, runtime.scope), enabled: active });

  if (asset.isPending) return <AssetStatus name={name} />;
  if (!asset.data || asset.isError) {
    return <AssetStatus failed name={name} retry={() => void asset.refetch()} />;
  }
  return (
    <Suspense fallback={<AssetStatus name={name} />}>
      {format === 'image' ? (
        <ImageDocument key={asset.data.version} name={name} resource={asset.data} />
      ) : format === 'media' && asset.data.kind === 'media' ? (
        <MediaDocument
          active={active}
          api={mediaApi}
          key={asset.data.version}
          name={name}
          navigation={navigation}
          resource={asset.data}
          runtime={runtime}
        />
      ) : format === 'pdf' ? (
        <PdfDocument
          key={asset.data.version}
          name={name}
          navigation={navigation}
          resource={asset.data}
          runtime={runtime}
        />
      ) : format === 'html' ? (
        <HtmlDocument
          active={active}
          key={asset.data.version}
          name={name}
          navigation={navigation}
          onNavigate={onNavigate}
          onOpenExternal={onOpenExternal}
          resource={asset.data}
          source={runtime.scope.source}
          tabId={runtime.scope.id}
        />
      ) : asset.data.kind === 'docx' ? (
        <DocxDocument
          active={active}
          api={docxPreviewApi}
          key={asset.data.version}
          name={name}
          navigation={navigation}
          onNavigate={onNavigate}
          onOpenExternal={onOpenExternal}
          resource={asset.data}
          runtime={runtime}
        />
      ) : (
        <AssetStatus failed name={name} retry={() => void asset.refetch()} />
      )}
    </Suspense>
  );
}
