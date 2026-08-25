import * as React from 'react';

import { cn } from '@/common/lib/utils';

/**
 * A titled block of a panel — the shape every Settings panel, callout, and
 * empty state was building by hand out of `<div className="text-base
 * font-semibold">` plus a muted `<div>` underneath.
 *
 * That recipe is why the whole 119-component renderer contained one `<h1>`
 * and five `<h2>`s: a heading that is a styled div announces nothing, so
 * screen readers got a wall of text with no outline to skim. Here the level
 * is a prop and the element is a real heading.
 */
function Section({ className, ...props }: React.ComponentProps<'section'>) {
  return <section data-slot="section" className={cn(className)} {...props} />;
}

/**
 * `level` runs the full 1–6 because nesting is the whole point of the prop
 * and the depth is not hypothetical: the Settings dialog's own title is an
 * `h2` (Base UI's `Dialog.Title`), which puts a panel at 3, a block inside
 * it at 4, and that block's own sub-heading at 5 — MCP access → Server
 * connection → Advanced reaches exactly there. A union that stopped at 4
 * did not make the tree shallower, it made the last two steps lie about
 * their depth.
 */
function SectionHeading({
  className,
  level = 2,
  ...props
}: React.ComponentProps<'h2'> & { level?: 1 | 2 | 3 | 4 | 5 | 6 }) {
  const Tag = `h${level}` as const;
  return (
    <Tag
      data-slot="section-heading"
      className={cn(
        // Chrome headings carry weight, not size: a workbench panel title
        // that jumps two type steps reads as a web page, not a tool.
        'm-0 text-base leading-snug font-semibold text-foreground',
        className,
      )}
      {...props}
    />
  );
}

/** The subdued line under a heading. Pairs with `FieldDescription`. */
function SectionDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="section-description"
      className={cn('m-0 text-sm leading-normal text-muted-foreground', className)}
      {...props}
    />
  );
}

export { Section, SectionDescription, SectionHeading };
