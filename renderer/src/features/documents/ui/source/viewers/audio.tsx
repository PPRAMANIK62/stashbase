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
  name,
  runtime,
  status,
}: DocumentViewerProps<'assetApi'>) {
  return (
    <AssetSurface active={active} api={assetApi} name={name} runtime={runtime} status={status}>
      {({ asset, retry }) =>
        asset.kind === 'media' ? (
          <MediaDocument
            active={active}
            key={asset.version}
            name={name}
            resource={asset}
            path={runtime.scope.source.path}
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
