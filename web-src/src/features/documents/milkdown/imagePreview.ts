import type { Editor } from '@milkdown/kit/core';
import { NodeSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { $useKeymap } from '@milkdown/kit/utils';

/** The two schema nodes that render a document image: commonmark's inline
 *  `image` and Crepe's `image-block`. Only a NodeSelection on one of these
 *  may open the lightbox — a paragraph that merely contains an image must
 *  keep its ordinary Enter behavior. */
const IMAGE_PREVIEW_NODE_NAMES = new Set(['image', 'image-block']);

/** The `stashbase-preview-image` payload for a rendered image element, or
 *  null when the element carries no resolved source (upload placeholders,
 *  blocked remote refs stripped by `refreshDocumentDom`). Reads the DOM
 *  element rather than node attrs so the src is the same mediated asset URL
 *  the click-to-preview path posts. */
export function imagePreviewMessage(
  image: HTMLImageElement | null,
): { type: 'stashbase-preview-image'; src: string; alt: string } | null {
  const src = image?.currentSrc || image?.src;
  if (!image || !src) return null;
  return { type: 'stashbase-preview-image', src, alt: image.alt || '' };
}

/** The rendered `<img>` of the current selection when — and only when —
 *  that selection is a NodeSelection on an image node. */
function selectedImageElement(view: EditorView): HTMLImageElement | null {
  const selection = view.state.selection;
  if (!(selection instanceof NodeSelection)) return null;
  if (!IMAGE_PREVIEW_NODE_NAMES.has(selection.node.type.name)) return null;
  const dom = view.nodeDOM(selection.from);
  if (!(dom instanceof HTMLElement)) return null;
  return dom instanceof HTMLImageElement ? dom : dom.querySelector('img');
}

/** Keyboard twin of CrepeDocument's click-to-preview: with an image node
 *  selected, Enter posts the same `stashbase-preview-image` message the
 *  host click listener sends. Registered through Milkdown's KeymapManager
 *  at priority 100 so it runs before commonmark's Enter chain, and it
 *  yields (returns false) on any non-image selection, so every other
 *  Enter binding keeps its behavior. */
export const imagePreviewKeymap = $useKeymap('stashbaseImagePreview', {
  openSelectedImagePreview: {
    shortcuts: 'Enter',
    priority: 100,
    command: () => (_state, _dispatch, view) => {
      if (!view) return false;
      const message = imagePreviewMessage(selectedImageElement(view));
      if (!message) return false;
      window.postMessage(message, window.location.origin);
      return true;
    },
  },
});

/** Crepe feature wrapper so CrepeDocument wires the keymap through the
 *  same `addFeature` pipeline as every other editor capability. */
export function imagePreviewFeature(editor: Editor): void {
  editor.use(imagePreviewKeymap);
}
