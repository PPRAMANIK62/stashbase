import { lazy } from 'react';

import { AssetSurface } from '@/features/documents/ui/source/asset';
import type { DocumentViewerProps } from '@/features/documents/ui/source/viewer';

const PdfDocument = lazy(async () => {
  const module = await import('@/features/documents/ui/pdf/document');
  return { default: module.PdfDocument };
});

export default function PdfViewer({
  active,
  assetApi,
  name,
  navigation,
  renderPreparation,
  runtime,
  status,
}: DocumentViewerProps<'assetApi' | 'navigation' | 'renderPreparation'>) {
  return (
    <AssetSurface
      active={active}
      api={assetApi}
      name={name}
      preparationSlot="pdf"
      renderPreparation={renderPreparation}
      runtime={runtime}
      status={status}
    >
      {({ asset }) => (
        <PdfDocument
          key={asset.version}
          name={name}
          navigation={navigation}
          resource={asset}
          runtime={runtime}
        />
      )}
    </AssetSurface>
  );
}
