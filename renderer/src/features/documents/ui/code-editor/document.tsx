import { useEffect, useRef } from 'react';

import type { DocumentRuntime } from '@/features/documents/application/document-runtime';
import type { DocumentNavigationRuntime } from '@/features/documents/application/navigation-runtime';

import { createCodeEditor, type CodeEditorLanguage } from './editor';
import { useCodeEditorSession } from './use-editor-session';

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
  const registrationOwnerRef = useRef(Symbol(runtime.scope.id));
  const { hostRef, sessionRef } = useCodeEditorSession({
    content,
    create: (host, report) =>
      createCodeEditor(host, { ariaLabel, content, language, onChange: report, readOnly }),
    onChange,
    readOnly,
    tabId: runtime.scope.id,
  });

  useEffect(() => {
    const controller = sessionRef.current?.find;
    if (!active || !controller) return;
    return navigation.claimFind(runtime.scope.id, registrationOwnerRef.current, controller);
  }, [active, navigation, runtime.scope.id, sessionRef]);

  return (
    <div
      className="size-full min-h-0 overflow-hidden bg-surface-2"
      data-document-access={readOnly ? 'read-only' : 'editable'}
      ref={hostRef}
    />
  );
}
