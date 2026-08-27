/**
 * The one code surface every CodeMirror viewer in the app renders on.
 *
 * Two viewers reach for it — the JSON source view and the text/code
 * viewer — and before this module they carried byte-identical copies of
 * the same theme block. A code surface that drifts between file types is
 * the exact thing a reader notices and cannot name: same monospace, same
 * pane, subtly different gutter or selection depending on which file
 * happened to be open.
 *
 * `stashbaseCodeTheme` owns the CHROME (surface, gutter, padding,
 * selection, active line). `stashbaseHighlightStyle` owns the TOKEN
 * COLOURS, off the shared `--syntax-*` roles in globals.css — a keyword
 * is one colour across the app whether it appears in a `.ts` file, and a
 * JSON atom takes that same role because it is the same kind of token.
 *
 * Language modes are NOT bundled. `@codemirror/language-data` ships a
 * descriptor per language whose grammar loads on demand, so opening a
 * `.ts` file fetches only the TypeScript grammar and opening a `.py` file
 * only the Python one. The descriptor list itself is metadata, and this
 * module is only ever reached from lazy viewer chunks — the renderer's
 * initial-JS budget (`scripts/check-renderer-chunks.mjs`) never sees it.
 */
import { HighlightStyle, LanguageDescription, syntaxHighlighting } from '@codemirror/language';
import { languages } from '@codemirror/language-data';
import { Compartment, type Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { tags } from '@lezer/highlight';

/** Surface chrome: everything about the editor that is not a token colour. */
export const stashbaseCodeTheme = EditorView.theme({
  '&': { height: '100%', backgroundColor: 'transparent', color: 'var(--fg)' },
  '.cm-scroller': { overflow: 'auto', fontFamily: 'var(--font-mono, ui-monospace, monospace)' },
  '.cm-content': { padding: '20px 0 72px', caretColor: 'var(--focus-ring)' },
  '.cm-line': { padding: '0 20px' },
  '.cm-gutters': { backgroundColor: 'var(--pane)', color: 'var(--muted)', border: '0' },
  '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'color-mix(in srgb, var(--accent) 7%, transparent)' },
  '&.cm-focused': { outline: 'none' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': { backgroundColor: 'color-mix(in srgb, var(--accent) 28%, transparent)' },
});

/**
 * Token colours for code, mapped onto the shared `--syntax-*` roles.
 *
 * Deliberately six roles, not the twenty a full editor theme ships: this
 * is a reading surface in a document tool, and a hue per token class
 * turns a config file into a rainbow. Identifiers and plain text keep
 * `--fg` by saying nothing here, so colour marks only the tokens that
 * carry structure.
 */
export const stashbaseHighlightStyle = HighlightStyle.define([
  { tag: [tags.keyword, tags.modifier, tags.controlKeyword, tags.operatorKeyword], color: 'var(--syntax-keyword)' },
  { tag: [tags.bool, tags.null, tags.atom], color: 'var(--syntax-keyword)' },
  { tag: [tags.string, tags.special(tags.string), tags.regexp], color: 'var(--syntax-string)' },
  { tag: [tags.number, tags.integer, tags.float], color: 'var(--syntax-number)' },
  { tag: [tags.comment, tags.lineComment, tags.blockComment, tags.docComment], color: 'var(--syntax-comment)' },
  { tag: [tags.propertyName, tags.function(tags.variableName), tags.definition(tags.variableName), tags.typeName, tags.className, tags.attributeName], color: 'var(--syntax-property)' },
  { tag: [tags.punctuation, tags.separator, tags.bracket, tags.operator], color: 'var(--syntax-punctuation)' },
  { tag: tags.invalid, color: 'var(--syntax-invalid)' },
]);

/** Theme + token colours, the pair every code viewer wants. */
export const stashbaseCodeSurface: Extension = [stashbaseCodeTheme, syntaxHighlighting(stashbaseHighlightStyle)];

/**
 * Resolves a filename to its CodeMirror grammar, or null when the
 * language is unknown — a plain `.log` or an extensionless `LICENSE`
 * renders as uncoloured monospace rather than guessing a grammar and
 * mis-colouring it.
 */
export function codeLanguageFor(fileName: string | undefined): LanguageDescription | null {
  if (!fileName) return null;
  const base = fileName.split('/').pop() ?? fileName;
  return LanguageDescription.matchFilename(languages, base);
}

/**
 * Loads a grammar into a live editor through `compartment`.
 *
 * Async and therefore racy by nature: a reader can close the tab, or the
 * viewer can swap files, while the grammar is still in flight.
 * `isCurrent` is checked after the await so a resolved grammar is never
 * pushed into an editor that has moved on or been destroyed.
 */
export async function loadCodeLanguage(
  view: EditorView,
  compartment: Compartment,
  fileName: string | undefined,
  isCurrent: () => boolean,
): Promise<void> {
  const description = codeLanguageFor(fileName);
  if (!description) return;
  const support = await description.load();
  if (!isCurrent()) return;
  view.dispatch({ effects: compartment.reconfigure(support) });
}
