import { JsonDocument } from '@/features/documents/ui/json/document';
import { TextSurface } from '@/features/documents/ui/source/text';
import type { DocumentViewerProps } from '@/features/documents/ui/source/viewer';

export default function JsonViewer({
  active,
  name,
  navigation,
  runtime,
  sourceApi,
  status,
}: DocumentViewerProps<'navigation' | 'sourceApi'>) {
  return (
    <TextSurface
      active={active}
      editorLabel="JSON editor"
      name={name}
      runtime={runtime}
      sourceApi={sourceApi}
      status={status}
    >
      {({ onChange, readOnly, value }) => (
        <JsonDocument
          active={active}
          name={name}
          navigation={navigation}
          onChange={onChange}
          readOnly={readOnly}
          runtime={runtime}
          value={value}
        />
      )}
    </TextSurface>
  );
}
