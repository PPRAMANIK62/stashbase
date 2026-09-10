import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import { tags } from '@lezer/highlight';

/** The one syntax palette every CodeMirror surface shares: weight and the
 *  muted tone carry structure, and only an invalid token takes a color. */
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

export const codeSyntaxHighlighting: Extension = syntaxHighlighting(codeHighlightStyle);
