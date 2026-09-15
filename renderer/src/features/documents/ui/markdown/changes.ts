import type { CrepeBuilder } from '@milkdown/crepe/builder';
import { serializerCtx } from '@milkdown/kit/core';
import { Plugin } from '@milkdown/kit/prose/state';
import { $prose } from '@milkdown/kit/utils';

/** Publish every edit before navigation or a native close can release the tab.
 * Milkdown's markdownUpdated listener is debounced and may be cancelled on dispose. */
export function watchMarkdownChanges(
  editor: CrepeBuilder,
  report: (markdown: string) => void,
): void {
  editor.editor.use(
    $prose(
      (context) =>
        new Plugin({
          view: () => ({
            update(view, previous) {
              if (!previous.doc.eq(view.state.doc))
                report(context.get(serializerCtx)(view.state.doc));
            },
          }),
        }),
    ),
  );
}
