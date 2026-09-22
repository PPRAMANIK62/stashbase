/**
 * The Markdown surface's seam for Humanize: which blocks a selection asks
 * about, what they look like as Markdown, and how a rewrite takes their
 * place in a whole-document proposal.
 *
 * The selection is widened to whole top-level blocks. Hemmingway-1 rewrites
 * a passage from its meaning, and half a sentence has none; a paragraph is
 * the smallest thing it can answer for. Only prose blocks go: a code block
 * or a table rewritten "the way a person would write it" is a broken code
 * block or table.
 *
 * The proposal is the live document with the rewrite in the selection's
 * place, serialized by the serializer that reads the document back, so the
 * review's diff falls inside the selection and nowhere else. The spelling of
 * the untouched Markdown may differ from the source file's, but the review
 * compares documents rather than text, and a change nobody accepts leaves
 * the file byte-identical either way.
 */
import { editorViewCtx, parserCtx, schemaCtx, serializerCtx } from '@milkdown/kit/core';
import type { Ctx } from '@milkdown/kit/ctx';
import { Slice, type Node as ProseNode } from '@milkdown/kit/prose/model';

import type { HumanizeRefusal } from '@/features/documents/domain/humanize';

const PROSE_BLOCKS: ReadonlySet<string> = new Set([
  'blockquote',
  'bullet_list',
  'heading',
  'ordered_list',
  'paragraph',
]);

export interface HumanizeTarget {
  /** Document positions of the blocks, so the rewrite lands where they were. */
  readonly from: number;
  readonly to: number;
  /** The blocks as Markdown, which is what the service is asked to rewrite. */
  readonly markdown: string;
}

/** The whole top-level blocks under the selection, or why there are none
 *  Hemmingway-1 should be handed. */
export function humanizeTarget(
  ctx: Ctx,
): HumanizeTarget | Extract<HumanizeRefusal, 'empty' | 'not-prose'> {
  const { doc, selection } = ctx.get(editorViewCtx).state;
  if (selection.empty) return 'empty';
  const blocks: ProseNode[] = [];
  let from = -1;
  let to = -1;
  let prose = true;
  doc.forEach((node, offset) => {
    const end = offset + node.nodeSize;
    if (end <= selection.from || offset >= selection.to) return;
    if (from < 0) from = offset;
    to = end;
    blocks.push(node);
    if (!PROSE_BLOCKS.has(node.type.name)) prose = false;
  });
  if (blocks.length === 0) return 'empty';
  if (!prose) return 'not-prose';
  const markdown = ctx.get(serializerCtx)(ctx.get(schemaCtx).topNodeType.create(null, blocks));
  return { from, to, markdown };
}

/** The whole document with `rewrite` where `target` was, or why that is not
 *  a review worth opening. */
export function humanizeProposal(
  ctx: Ctx,
  target: HumanizeTarget,
  rewrite: string,
): string | Extract<HumanizeRefusal, 'unchanged' | 'unusable'> {
  const { doc } = ctx.get(editorViewCtx).state;
  const parsed = ctx.get(parserCtx)(rewrite);
  if (parsed.content.childCount === 0 || parsed.textContent.trim() === '') return 'unusable';
  let next: ProseNode;
  try {
    next = doc.replace(target.from, target.to, new Slice(parsed.content, 0, 0));
  } catch {
    return 'unusable';
  }
  const serialize = ctx.get(serializerCtx);
  const proposal = serialize(next);
  return proposal === serialize(doc) ? 'unchanged' : proposal;
}
