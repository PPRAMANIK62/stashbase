import { GenericFileDocument } from '@/features/documents/ui/generic/document';
import type { DocumentViewerProps } from '@/features/documents/ui/source/viewer';

export default function GenericViewer({
  active,
  genericPreviewApi,
  navigation,
  onReveal,
  revealLabel,
  runtime,
  status,
}: DocumentViewerProps<'genericPreviewApi' | 'navigation' | 'onReveal' | 'revealLabel'>) {
  return (
    <GenericFileDocument
      active={active}
      api={genericPreviewApi}
      navigation={navigation}
      onReveal={onReveal}
      revealLabel={revealLabel}
      runtime={runtime}
      status={status}
    />
  );
}
