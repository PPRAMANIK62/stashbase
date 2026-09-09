import { lazy } from 'react';

import { DocumentAssetError } from '@/features/documents/application/ports';
import { AssetSurface } from '@/features/documents/ui/source/asset';
import type { DocumentViewerProps } from '@/features/documents/ui/source/viewer';

const MediaDocument = lazy(async () => {
  const module = await import('@/features/documents/ui/media/document');
  return { default: module.MediaDocument };
});

export default function AudioViewer({
  active,
  assetApi,
  mediaApi,
  name,
  navigation,
  onOpenPrepared,
  runtime,
  status,
}: DocumentViewerProps<'assetApi' | 'mediaApi' | 'navigation' | 'onOpenPrepared'>) {
  return (
    <AssetSurface
      active={active}
      api={assetApi}
      name={name}
      onOpenPrepared={onOpenPrepared}
      prepareOnOpen="audio"
      runtime={runtime}
      status={status}
    >
      {({ asset, retry }) =>
        asset.kind === 'media' ? (
          <MediaDocument
            active={active}
            api={mediaApi}
            key={asset.version}
            name={name}
            navigation={navigation}
            resource={asset}
            runtime={runtime}
          />
        ) : (
          status({
            error: new DocumentAssetError('invalid-response', `${name} is not a playable asset.`),
            name,
            retry,
          })
        )
      }
    </AssetSurface>
  );
}
