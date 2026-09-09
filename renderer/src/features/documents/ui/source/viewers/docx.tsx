import { lazy } from 'react';

import { DocumentAssetError } from '@/features/documents/application/ports';
import { AssetSurface } from '@/features/documents/ui/source/asset';
import type { DocumentViewerProps } from '@/features/documents/ui/source/viewer';

const DocxDocument = lazy(async () => {
  const module = await import('@/features/documents/ui/docx/document');
  return { default: module.DocxDocument };
});

export default function DocxViewer({
  active,
  assetApi,
  docxPreviewApi,
  name,
  navigation,
  onNavigate,
  onOpenExternal,
  onOpenPrepared,
  renderPreparation,
  runtime,
  status,
}: DocumentViewerProps<
  | 'assetApi'
  | 'docxPreviewApi'
  | 'navigation'
  | 'onNavigate'
  | 'onOpenExternal'
  | 'onOpenPrepared'
  | 'renderPreparation'
>) {
  return (
    <AssetSurface
      active={active}
      api={assetApi}
      name={name}
      onOpenPrepared={onOpenPrepared}
      preparationSlot="docx"
      prepareOnOpen="docx"
      renderPreparation={renderPreparation}
      runtime={runtime}
      status={status}
    >
      {({ asset, retry }) =>
        asset.kind === 'docx' ? (
          <DocxDocument
            active={active}
            api={docxPreviewApi}
            key={asset.version}
            name={name}
            navigation={navigation}
            onNavigate={onNavigate}
            onOpenExternal={onOpenExternal}
            resource={asset}
            runtime={runtime}
          />
        ) : (
          status({
            error: new DocumentAssetError('invalid-response', `${name} is not a DOCX asset.`),
            name,
            retry,
          })
        )
      }
    </AssetSurface>
  );
}
