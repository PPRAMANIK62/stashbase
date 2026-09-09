import { MarkdownDocument } from '@/features/documents/ui/markdown/document';
import { TextSurface } from '@/features/documents/ui/source/text';
import type { DocumentViewerProps } from '@/features/documents/ui/source/viewer';

export default function MarkdownViewer({
  active,
  name,
  navigation,
  onNavigate,
  onOpenExternal,
  runtime,
  sourceApi,
  status,
}: DocumentViewerProps<'navigation' | 'onNavigate' | 'onOpenExternal' | 'sourceApi'>) {
  return (
    <TextSurface
      active={active}
      editorLabel="Markdown editor"
      name={name}
      runtime={runtime}
      sourceApi={sourceApi}
      status={status}
    >
      {({ access, editor, markdownMode, onChange, readOnly, value }) => (
        <MarkdownDocument
          active={active}
          canChangeMode={access === 'editable' && editor !== null}
          dirty={editor !== null && editor.value !== editor.baseline}
          mode={markdownMode}
          name={name}
          navigation={navigation}
          onChange={onChange}
          onModeChange={(mode) => runtime.setMarkdownMode(mode)}
          onNavigate={onNavigate}
          onOpenExternal={onOpenExternal}
          readOnly={readOnly || markdownMode === 'reading'}
          source={runtime.scope.source}
          tabId={runtime.scope.id}
          value={value}
        />
      )}
    </TextSurface>
  );
}
