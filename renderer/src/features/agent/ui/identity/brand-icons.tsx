import claudeCodeMark from '@lobehub/icons-static-svg/icons/claudecode-color.svg?raw';
import codexMark from '@lobehub/icons-static-svg/icons/codex-color.svg?raw';

import type { IconComponentProps } from '@/lib/icon-context';

/** The vendor marks fill their whole 24-unit viewBox while lucide keeps a
 *  2-unit safe area, so the viewBox widens by that margin to give both the
 *  same optical footprint at any size. */
const VIEW_BOX = '-2 -2 28 28';

function brandIcon(source: string, displayName: string) {
  const markup = source
    .replace(/^\s*<svg[^>]*>/u, '')
    .replace(/<\/svg>\s*$/u, '')
    .replace(/<title>[^<]*<\/title>/u, '');
  function BrandIcon({ className, size = 24 }: IconComponentProps) {
    return (
      <svg
        aria-hidden="true"
        className={className}
        dangerouslySetInnerHTML={{ __html: markup }}
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
