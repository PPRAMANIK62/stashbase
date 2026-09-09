import { lazy } from 'react';

import { AssetSurface } from '@/features/documents/ui/source/asset';
import type { DocumentViewerProps } from '@/features/documents/ui/source/viewer';

const HtmlDocument = lazy(async () => {
  const module = await import('@/features/documents/ui/html/document');
  return { default: module.HtmlDocument };
});

export default function HtmlViewer({
  active,
  assetApi,
  name,
  navigation,
  onNavigate,
  onOpenExternal,
  runtime,
  status,
}: DocumentViewerProps<'assetApi' | 'navigation' | 'onNavigate' | 'onOpenExternal'>) {
  return (
    <AssetSurface active={active} api={assetApi} name={name} runtime={runtime} status={status}>
      {({ asset }) => (
        <HtmlDocument
          active={active}
          key={asset.version}
          name={name}
          navigation={navigation}
          onNavigate={onNavigate}
          onOpenExternal={onOpenExternal}
          resource={asset}
          source={runtime.scope.source}
          tabId={runtime.scope.id}
        />
      )}
    </AssetSurface>
  );
}
