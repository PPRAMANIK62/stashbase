import type { Ctx } from '@milkdown/kit/ctx';
import { editorViewCtx } from '@milkdown/kit/core';
import { linkSchema } from '@milkdown/kit/preset/commonmark';
import { TextSelection } from '@milkdown/kit/prose/state';

/**
 * Insert `displayName` at `pos` as a text node carrying a real link mark
 * (built from Milkdown's own `linkSchema`, the same mark `linkTooltip`
 * creates), not plain unlinked text — so the result round-trips through
 * Milkdown's Markdown serializer back to `[displayName](href)` on save.
 * Moves the cursor just past the inserted text and refocuses the view,
 * matching how a built-in slash-menu item leaves the editor afterward.
 *
 * Requires a live ProseMirror view, so this is intentionally left out of
 * the unit-testable surface; `linkFileInsertionText` owns the pure part.
 */
export function insertLinkText(ctx: Ctx, pos: number, displayName: string, href: string): void {
  const view = ctx.get(editorViewCtx);
  const mark = linkSchema.type(ctx).create({ href, title: null });
  const node = view.state.schema.text(displayName, [mark]);
  let tr = view.state.tr.insert(pos, node);
  tr = tr.setSelection(TextSelection.create(tr.doc, pos + node.nodeSize));
  view.dispatch(tr.scrollIntoView());
  view.focus();
}
