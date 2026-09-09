import { CodeEditorDocument } from '@/features/documents/ui/code-editor/document';
import { TextSurface } from '@/features/documents/ui/source/text';
import type { DocumentViewerProps } from '@/features/documents/ui/source/viewer';

export default function PlainTextViewer({
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
      editorLabel="text editor"
      name={name}
      runtime={runtime}
      sourceApi={sourceApi}
      status={status}
    >
      {({ onChange, readOnly, value }) => (
        <CodeEditorDocument
          active={active}
          ariaLabel={`${name} source`}
          content={value}
          language={{ kind: 'plain' }}
          navigation={navigation}
          onChange={onChange}
          readOnly={readOnly}
          runtime={runtime}
        />
      )}
    </TextSurface>
  );
}
