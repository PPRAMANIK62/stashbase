import { cva } from 'class-variance-authority';

import { FileTypeIcon } from '@/common/components/FileTypeIcon';
import { ImageLightbox } from '@/common/components/ImageLightbox';
import { Button } from '@/common/components/ui/button';
import { fileGlyphFormat } from '@/common/lib/fileGlyphFormat';
import type { Attachment } from '@/features/agent-panel/lib/types';

/**
 * One attachment, in the composer or in a sent turn.
 *
 * The two shapes are one chip: a rounded, bordered, muted box in the
 * panel's neutral palette. What differs is what the box is FOR. A file has
 * nothing to look at, so the chip is a two-line card — a type glyph, the
 * name, the type label under it. An image is its own label, so the chip is
 * a 64px thumbnail and the name moves into the accessible name.
 */
const attachmentChipVariants = cva('rounded-lg border border-border bg-muted', {
  variants: {
    kind: {
      file: 'inline-flex max-w-72 items-center gap-2 py-1.5 pr-1.5 pl-2 text-xs text-foreground',
      /** `relative` because the remove control floats inside this box; the
       * thumbnail fills it edge to edge, so there is nowhere else to put
       * one. `shadow-low` is the one non-overlay shadow the panel spends. */
      image: 'relative size-16 overflow-hidden shadow-low',
    },
  },
  defaultVariants: { kind: 'file' },
});

/**
 * The remove control, whose placement is decided by the chip's shape
 * rather than by the call site. Both call sites used to pass this button
 * in as a `trailing` node, which is how the composer ended up spelling two
 * different × recipes a few lines apart — and why neither of them could be
 * checked against the other.
 */
const attachmentRemoveVariants = cva('grid size-4 cursor-pointer place-items-center p-0', {
  variants: {
    placement: {
      /** In the file card's own row, after the text column. */
      inline: 'shrink-0 rounded-sm border-0 bg-transparent text-lg leading-none text-muted-foreground hover:bg-active hover:text-foreground',
      /** Over the thumbnail's corner. It needs its own fill and stroke to
       * stay legible against an arbitrary image, and a 10px glyph because
       * the box it sits in is 16 — below the button ramp the box is the
       * constraint and the step comes off it. */
      floating: 'absolute top-1 right-1 rounded-full border border-border/80 bg-background/75 text-foreground [&_svg]:block [&_svg]:size-2.5 [&_svg]:fill-none [&_svg]:stroke-current [&_svg]:stroke-2 [&_svg]:[stroke-linecap:round]',
    },
  },
  defaultVariants: { placement: 'inline' },
});

/**
 * `onRemove` is the whole difference between a composer chip and a
 * transcript one: a draft attachment can still be taken back, a sent one
 * cannot. Passing it is what grows the × — the caller never decides which
 * × or where it goes.
 */
export function AttachmentChip({ attachment, onPreview, onRemove }: {
  attachment: Attachment;
  /** Opens the full-size preview. The caller owns which attachment is
   *  being previewed and renders one `AttachmentLightbox` for all of them. */
  onPreview?: () => void;
  onRemove?: () => void;
}) {
  const { name, path, dims, previewUrl } = attachment;
  if (previewUrl) {
    return (
      <span className={attachmentChipVariants({ kind: 'image' })}>
        <Button
          variant="ghost"
          className="block h-full w-full cursor-zoom-in border-0 bg-transparent p-0 [&_img]:block [&_img]:h-full [&_img]:w-full [&_img]:object-cover"
          aria-label={`Preview ${name}`}
          onClick={onPreview}
        >
          <img src={previewUrl} alt="" />
        </Button>
        {onRemove && (
          <Button
            variant="ghost"
            className={attachmentRemoveVariants({ placement: 'floating' })}
            aria-label={`Remove ${name}`}
            onClick={onRemove}
          >
            <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">
              <path d="m2.25 2.25 7.5 7.5M9.75 2.25l-7.5 7.5" />
            </svg>
          </Button>
        )}
      </span>
    );
  }
  const { format, label } = fileGlyphFormat(name);
  return (
    <span className={attachmentChipVariants({ kind: 'file' })} title={path}>
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-background text-muted-foreground [&_svg]:size-4">
        <FileTypeIcon format={format} />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5 leading-tight">
        <span className="overflow-hidden text-ellipsis whitespace-nowrap font-medium">{name}</span>
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {dims ? `${label} · ${dims}` : label}
        </span>
      </span>
      {onRemove && (
        <Button
          variant="ghost"
          className={attachmentRemoveVariants({ placement: 'inline' })}
          aria-label={`Remove ${name}`}
          onClick={onRemove}
        >
          ×
        </Button>
      )}
    </span>
  );
}

/** The lightbox an image chip's press opens. Renders nothing until an
 *  attachment with a preview URL is selected, so callers can keep a single
 *  `useState<Attachment | null>` and mount this unconditionally. */
export function AttachmentLightbox({ attachment, onClose }: {
  attachment: Attachment | null;
  onClose: () => void;
}) {
  if (!attachment?.previewUrl) return null;
  return <ImageLightbox src={attachment.previewUrl} alt={attachment.name} onClose={onClose} />;
}
