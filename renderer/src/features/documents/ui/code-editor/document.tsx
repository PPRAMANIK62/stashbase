import { useEffect, useRef } from 'react';

import type { DocumentRuntime } from '@/features/documents/application/document-runtime';
import type { DocumentNavigationRuntime } from '@/features/documents/application/navigation-runtime';

import { createCodeEditor, type CodeEditorLanguage, type CodeEditorSession } from './editor';

export function CodeEditorDocument({
  active,
  ariaLabel,
  content,
  language,
  navigation,
  onChange,
  readOnly,
  runtime,
}: {
  active: boolean;
  ariaLabel: string;
  content: string;
  language: CodeEditorLanguage;
  navigation: DocumentNavigationRuntime;
  onChange(value: string): void;
  readOnly: boolean;
  runtime: DocumentRuntime;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<CodeEditorSession | null>(null);
  const onChangeRef = useRef(onChange);
  const registrationOwnerRef = useRef(Symbol(runtime.scope.id));
  onChangeRef.current = onChange;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const editor = createCodeEditor(host, {
      ariaLabel,
      content,
      language,
      onChange: (value) => onChangeRef.current(value),
      readOnly,
    });
    editorRef.current = editor;
    return () => {
      if (editorRef.current === editor) editorRef.current = null;
      editor.destroy();
    };
    // One editor per document runtime retains selection and history.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtime.scope.id]);

  useEffect(() => editorRef.current?.setReadOnly(readOnly), [readOnly]);
  useEffect(() => editorRef.current?.applyContent(content), [content]);

  useEffect(() => {
    const controller = editorRef.current?.find;
    if (!active || !controller) return;
    return navigation.claimFind(runtime.scope.id, registrationOwnerRef.current, controller);
  }, [active, navigation, runtime.scope.id]);

  return (
    <div
      className="size-full min-h-0 overflow-hidden bg-surface-2"
      data-document-access={readOnly ? 'read-only' : 'editable'}
      ref={hostRef}
    />
  );
}
