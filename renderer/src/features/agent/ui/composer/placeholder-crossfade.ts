/** How a new placeholder arrives in the editor: not snapped, but crossfaded
 *  at the ambient pace, slower than any interaction step. The old text fades
 *  out over the ambient out-step; then the text swaps while the fading
 *  mark is still on, so the fresh node CodeMirror builds for it is born
 *  transparent; then the mark comes off a frame later and the theme's slow
 *  transition eases the new text in. While the reader's own text hides the
 *  placeholder there is nothing to fade, so it is swapped in place. */
import type { Compartment } from '@codemirror/state';
import { EditorView, placeholder } from '@codemirror/view';

import { ambient } from '@/lib/springs';

const FADING = EditorView.contentAttributes.of({ 'data-placeholder-fading': '' });

/** Starts the crossfade to `text` and returns the way to cancel it. */
export function crossfadePlaceholder(
  view: EditorView,
  compartments: { readonly placeholder: Compartment; readonly fade: Compartment },
  text: string,
): () => void {
  const setText = () =>
    view.dispatch({ effects: compartments.placeholder.reconfigure(placeholder(text)) });
  const reveal = () => view.dispatch({ effects: compartments.fade.reconfigure([]) });
  if (view.state.doc.length > 0) {
    setText();
    reveal();
    return () => undefined;
  }
  view.dispatch({ effects: compartments.fade.reconfigure(FADING) });
  let frame = 0;
  const timer = setTimeout(() => {
    setText();
    // Two frames: the first lets the new node's transparent style settle, so
    // the second's change is a transition rather than an initial paint.
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(reveal);
    });
  }, ambient.crossfadeOutMs);
  return () => {
    clearTimeout(timer);
    cancelAnimationFrame(frame);
  };
}
