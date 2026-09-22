/**
 * The Humanize control on Crepe's selection toolbar.
 *
 * It is a word, not a glyph. Crepe's own items are formatting marks every
 * editor draws the same way; Humanize is a product action nothing draws, and
 * a sparkle beside them said neither "human" nor "rewrite". The site names
 * the tool in words too. Crepe takes the item's content as an HTML string,
 * so the label is one span `document.css` gives its width and type; the
 * button Crepe renders has no label of its own, so the word is also the
 * control's accessible name.
 */
import type { ToolbarFeatureConfig } from '@milkdown/crepe/feature/toolbar';

const HUMANIZE_LABEL = '<span class="markdown-humanize-label">Humanize</span>';

/** The toolbar with Humanize as its own group after Crepe's formatting and
 *  function groups. `run` is read on each click, so the handler behind it may
 *  change without rebuilding the editor. */
export function humanizeToolbar(run: () => void): ToolbarFeatureConfig {
  return {
    buildToolbar: (builder) => {
      builder.addGroup('humanize', 'Humanize').addItem('humanize', {
        active: () => false,
        icon: HUMANIZE_LABEL,
        onRun: () => run(),
      });
    },
  };
}
