import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { lazy, Suspense } from 'react';

import { Button } from '@/components/ui/button';
import type { DocumentRuntime } from '@/features/documents/application/document-runtime';
import type { DocumentNavigationRuntime } from '@/features/documents/application/navigation-runtime';
import type { DocumentAssetApi } from '@/features/documents/application/ports';
import { documentAssetQuery } from '@/features/documents/application/queries';

const ImageDocument = lazy(async () => {
  const module = await import('./image/document');
  return { default: module.ImageDocument };
});

const PdfDocument = lazy(async () => {
  const module = await import('./pdf/document');
  return { default: module.PdfDocument };
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
  format,
  name,
  navigation,
  runtime,
}: {
  active: boolean;
  api: DocumentAssetApi;
  format: 'image' | 'pdf';
  name: string;
  navigation: DocumentNavigationRuntime;
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
      ) : (
        <PdfDocument
          key={asset.data.version}
          name={name}
          navigation={navigation}
          resource={asset.data}
          runtime={runtime}
        />
      )}
    </Suspense>
  );
}
