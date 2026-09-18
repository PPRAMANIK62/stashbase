import claudeMark from '@lobehub/icons-static-svg/icons/claude-color.svg?raw';
import codexMark from '@lobehub/icons-static-svg/icons/codex-color.svg?raw';
import { useId, useMemo } from 'react';

import type { IconComponentProps } from '@/lib/icon-context';

import { Logo } from './logo';

/** The vendor marks fill their whole 24-unit viewBox while lucide keeps a
 *  2-unit safe area, so the viewBox widens by that margin to give both the
 *  same optical footprint at any size. */
const VIEW_BOX = '-2 -2 28 28';

/** A mark's gradient ids are the same in every copy of the file. Once the
 *  mark is inlined several times, `url(#id)` resolves to the first id in
 *  the document, and a first copy inside a hidden subtree paints nothing,
 *  so every instance gets ids of its own. */
function withInstanceIds(markup: string, instance: string): string {
  return markup
    .replace(/\bid="([^"]+)"/gu, (_match, id: string) => `id="${id}-${instance}"`)
    .replace(/url\(#([^)]+)\)/gu, (_match, id: string) => `url(#${id}-${instance})`);
}

function brandIcon(source: string, displayName: string) {
  const markup = source
    .replace(/^\s*<svg[^>]*>/u, '')
    .replace(/<\/svg>\s*$/u, '')
    .replace(/<title>[^<]*<\/title>/u, '');
  function BrandIcon({ className, size = 24 }: IconComponentProps) {
    const instance = useId().replace(/[^a-z0-9]/giu, '');
    const html = useMemo(() => withInstanceIds(markup, instance), [instance]);
    return (
      <svg
        aria-hidden="true"
        className={className}
        dangerouslySetInnerHTML={{ __html: html }}
        height={size}
        viewBox={VIEW_BOX}
        width={size}
        xmlns="http://www.w3.org/2000/svg"
      />
    );
  }
  BrandIcon.displayName = displayName;
  return BrandIcon;
}

export const ClaudeIcon = brandIcon(claudeMark, 'ClaudeIcon');
export const CodexIcon = brandIcon(codexMark, 'CodexIcon');

/** The bundled Agent wears StashBase's own mark: it is the runtime the app
 *  ships rather than a vendor's, so the app's mark is what names it.
 *
 *  The logo is drawn for the 40px welcome lockup, and two things have to move
 *  for it to sit beside the vendor marks. Its box is recentred on the mark's
 *  own bounds, which sit low and left of the 512-unit square, so the glyph
 *  lands at about 11.5px of a 16px icon — between Codex's 10.3px square and
 *  Claude's 13.7px starburst. And its strokes, 1px at that size, thicken a
 *  quarter to the 1.25px the marks around them carry.
 *
 *  Like the vendor marks it ignores `strokeWidth`: the two weights are part
 *  of the drawing, and a caller's icon stroke is not the mark's to take. */
export function StashBaseIcon({ className, size = 24 }: IconComponentProps) {
  return (
    <Logo
      aria-hidden="true"
      className={className}
      height={size}
      strokeScale={1.25}
      viewBox="6 -21 512 512"
      width={size}
    />
  );
}
