import claudeCodeMark from '@lobehub/icons-static-svg/icons/claudecode.svg?raw';
import codexMark from '@lobehub/icons-static-svg/icons/codex.svg?raw';

import type { IconComponentProps } from '@/lib/icon-context';
import { cn } from '@/lib/utils';

interface BrandIconProps extends IconComponentProps {
  'aria-hidden'?: boolean | 'false' | 'true';
}

function brandIcon(source: string, displayName: string) {
  function BrandIcon({ 'aria-hidden': ariaHidden = true, className, size }: BrandIconProps) {
    return (
      <span
        aria-hidden={ariaHidden}
        className={cn(
          'inline-flex size-[1em] shrink-0 translate-y-px items-center justify-center [&_svg]:block [&_svg]:size-full [&_svg]:fill-current',
          className,
        )}
        dangerouslySetInnerHTML={{ __html: source }}
        style={size === undefined ? undefined : { height: size, width: size }}
      />
    );
  }
  BrandIcon.displayName = displayName;
  return BrandIcon;
}

export const ClaudeCodeIcon = brandIcon(claudeCodeMark, 'ClaudeCodeIcon');
export const CodexIcon = brandIcon(codexMark, 'CodexIcon');
