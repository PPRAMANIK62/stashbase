import { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view';
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from '@codemirror/commands';
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
  indentOnInput,
  foldGutter,
} from '@codemirror/language';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { html as htmlLang } from '@codemirror/lang-html';
import { markdown as mdLang } from '@codemirror/lang-markdown';
import { useApp } from '../store/AppContext';

/**
 * CodeMirror 6 host. Mounts a CM EditorView into a div the first time,
 * destroys it on unmount, and registers `{ getValue, focus }` with the
 * store so the save / rename actions can read the live buffer without
 * prop-drilling refs around.
 *
 * Editor identity is keyed by `{file, format}` — flipping either
 * destroys the view + makes a new one (no state to migrate, the new
 * content comes in fresh). Initial content is read once from props at
 * mount time and never thereafter — CM owns the buffer.
 */
export function CodeEditor({
  initialContent,
  format,
  onChange,
}: {
  initialContent: string;
  format: 'md' | 'html';
  onChange?: (doc: string) => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const { state, actions } = useApp();
  // Snapshot at mount time: if a rename is in progress (newNote starts
  // edit-mode AND rename together), let the RenameInput keep focus —
  // grabbing it here would blur the input, fire its onBlur commit,
  // and tear down the rename UI before the user can type a name.
  const renamingAtMountRef = useRef(state.renaming != null);
  renamingAtMountRef.current = state.renaming != null;
  // Track rename transition so we can pull focus back to the editor
  // when the user finishes (Enter) or cancels (Esc) — completes the
  // newNote → name it → start typing flow without a manual click.
  const prevRenamingRef = useRef(state.renaming != null);
  // Stable callbacks accessed from inside the CM updateListener (which
  // captures whatever's current at mount time). Refs side-step that.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const lang = format === 'html' ? htmlLang() : mdLang();
    const extensions = [
      lineNumbers(),
      foldGutter(),
      history(),
      bracketMatching(),
      indentOnInput(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      highlightActiveLine(),
      highlightSelectionMatches(),
      keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap, ...searchKeymap]),
      EditorView.theme({
        '&': { height: '100%', fontSize: '13px' },
        '.cm-scroller': {
          fontFamily:
            '"SF Mono", "JetBrains Mono", Menlo, Consolas, "Liberation Mono", monospace',
          lineHeight: '1.55',
        },
        '.cm-content': { padding: '12px 0' },
        '.cm-gutters': {
          background: 'transparent',
          color: '#9aa0a6',
          border: 'none',
        },
        '.cm-activeLine': { background: 'rgba(0,0,0,0.025)' },
        '.cm-activeLineGutter': { background: 'transparent', color: '#5f6368' },
      }),
      lang,
      EditorView.updateListener.of((u) => {
        if (u.docChanged) onChangeRef.current?.(u.state.doc.toString());
      }),
    ];

    const view = new EditorView({
      state: EditorState.create({ doc: initialContent, extensions }),
      parent: host,
    });
    viewRef.current = view;
    actions.registerEditor({
      getValue: () => view.state.doc.toString(),
      focus: () => view.focus(),
    });
    if (!renamingAtMountRef.current) view.focus();

    return () => {
      actions.registerEditor(null);
      view.destroy();
      viewRef.current = null;
    };
  // Mount once per `{format}` change; initialContent and onChange are
  // captured via refs so they don't trigger re-mounts.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format]);

  // Re-focus the editor when an inline rename ends (commit or cancel).
  useEffect(() => {
    const isRenaming = state.renaming != null;
    if (prevRenamingRef.current && !isRenaming) {
      viewRef.current?.focus();
    }
    prevRenamingRef.current = isRenaming;
  }, [state.renaming]);

  return <div ref={hostRef} style={{ height: '100%' }} />;
}
