import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import {
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  lineNumbers,
} from '@codemirror/view';
import { tags } from '@lezer/highlight';

const codeSurfaceTheme = EditorView.theme({
  '&': {
    backgroundColor: 'transparent',
    color: 'var(--foreground)',
    fontSize: 'var(--fs-body, 13px)',
    height: '100%',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'var(--hover)' },
  '.cm-content': {
    caretColor: 'var(--foreground)',
    fontFamily: 'var(--font-mono)',
    lineHeight: '1.55',
    padding: '12px 0 64px',
  },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--foreground)' },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    borderRight: '0',
    color: 'var(--muted-foreground)',
  },
  '.cm-line': { padding: '0 6px', position: 'relative' },
  '.cm-lineNumbers .cm-gutterElement': {
    minWidth: '2.5ch',
    padding: '0 4px',
    textAlign: 'right',
  },
  '.cm-scroller': { fontFamily: 'inherit', overflow: 'auto' },
  '.cm-selectionBackground, ::selection': { backgroundColor: 'var(--selected) !important' },
});

const codeHighlightStyle = HighlightStyle.define([
  { fontWeight: '500', tag: [tags.keyword, tags.modifier, tags.controlKeyword] },
  { color: 'var(--muted-foreground)', tag: [tags.string, tags.regexp] },
  { color: 'var(--muted-foreground)', fontStyle: 'italic', tag: tags.comment },
  { tag: [tags.bool, tags.null, tags.number] },
  { color: 'var(--muted-foreground)', tag: [tags.punctuation, tags.separator, tags.bracket] },
  {
    fontWeight: '500',
    tag: [tags.propertyName, tags.definition(tags.variableName), tags.typeName],
  },
  { color: 'var(--destructive)', tag: tags.invalid },
]);

export const codeSurfaceExtensions: Extension = [
  lineNumbers(),
  highlightActiveLine(),
  highlightActiveLineGutter(),
  EditorView.lineWrapping,
  codeSurfaceTheme,
];

export const codeSyntaxHighlighting: Extension = syntaxHighlighting(codeHighlightStyle);
