import claudeCodeMark from '@lobehub/icons-static-svg/icons/claudecode-color.svg?raw';
import codexMark from '@lobehub/icons-static-svg/icons/codex-color.svg?raw';
import { useId, useMemo } from 'react';

import type { IconComponentProps } from '@/lib/icon-context';

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

export const ClaudeCodeIcon = brandIcon(claudeCodeMark, 'ClaudeCodeIcon');
export const CodexIcon = brandIcon(codexMark, 'CodexIcon');
