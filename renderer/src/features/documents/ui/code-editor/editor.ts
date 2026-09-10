import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { LanguageDescription } from '@codemirror/language';
import { languages } from '@codemirror/language-data';
import { Compartment, EditorState, type Extension } from '@codemirror/state';
import { EditorView, keymap, type KeyBinding } from '@codemirror/view';

import type { DocumentFindController } from '@/features/documents/application/navigation-runtime';

import { createCodeFindController } from './find-controller';
import { codeSurfaceExtensions, codeSyntaxHighlighting } from './surface';

export type CodeEditorLanguage = { kind: 'filename'; fileName: string } | { kind: 'plain' };

export interface CodeEditorSession {
  applyContent(content: string): void;
  destroy(): void;
  find: DocumentFindController;
  focus(): void;
  setReadOnly(readOnly: boolean): void;
}

export interface CodeEditorOptions {
  ariaLabel: string;
  content: string;
  extensions?: Extension;
  keyBindings?: readonly KeyBinding[];
  language?: CodeEditorLanguage;
  onChange(value: string): void;
  readOnly: boolean;
}

export function normalizeEditorText(content: string): string {
  return content.replace(/\r\n?/gu, '\n');
}

function readOnlyExtensions(readOnly: boolean) {
  return [
    EditorState.readOnly.of(readOnly),
    EditorView.editable.of(!readOnly),
    EditorView.contentAttributes.of({ 'aria-readonly': String(readOnly) }),
  ];
}

export function createCodeEditor(host: HTMLElement, options: CodeEditorOptions): CodeEditorSession {
  const readOnly = new Compartment();
  const syntax = new Compartment();
  let applyingExternal = false;
  let destroyed = false;
  const view = new EditorView({
    parent: host,
    state: EditorState.create({
      doc: normalizeEditorText(options.content),
      extensions: [
        history(),
        syntax.of([]),
        readOnly.of(readOnlyExtensions(options.readOnly)),
        codeSurfaceExtensions,
        options.extensions ?? [],
        keymap.of([...(options.keyBindings ?? []), ...defaultKeymap, ...historyKeymap]),
        EditorView.contentAttributes.of({
          'aria-label': options.ariaLabel,
          autocapitalize: 'off',
          spellcheck: 'false',
        }),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged || applyingExternal) return;
          options.onChange(update.state.doc.toString());
        }),
      ],
    }),
  });

  if (options.language?.kind === 'filename') {
    const description = LanguageDescription.matchFilename(languages, options.language.fileName);
    if (description) {
      void description.load().then((support) => {
        if (destroyed) return;
        view.dispatch({ effects: syntax.reconfigure([support, codeSyntaxHighlighting]) });
      });
    }
  }

  return {
    applyContent(next) {
      const normalizedNext = normalizeEditorText(next);
      const current = view.state.doc.toString();
      if (current === normalizedNext) return;
      let from = 0;
      while (
        from < current.length &&
        from < normalizedNext.length &&
        current[from] === normalizedNext[from]
      ) {
        from += 1;
      }
      let currentTo = current.length;
      let nextTo = normalizedNext.length;
      while (
        currentTo > from &&
        nextTo > from &&
        current[currentTo - 1] === normalizedNext[nextTo - 1]
      ) {
        currentTo -= 1;
        nextTo -= 1;
      }
      applyingExternal = true;
      try {
        view.dispatch({
          changes: { from, insert: normalizedNext.slice(from, nextTo), to: currentTo },
        });
      } finally {
        applyingExternal = false;
      }
    },
    destroy() {
      destroyed = true;
      view.destroy();
    },
    find: createCodeFindController(() => view),
    focus() {
      view.focus();
    },
    setReadOnly(next) {
      view.dispatch({ effects: readOnly.reconfigure(readOnlyExtensions(next)) });
    },
  };
}
