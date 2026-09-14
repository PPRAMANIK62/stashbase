import type { CSSProperties, ReactNode } from 'react';

import { cn } from '@/lib/utils';
import type { FailureView } from '@/shared/domain/feature-error';

/**
 * One failure, said the way its kind deserves.
 *
 * A refusal of what the reader typed or asked for is an alert in the
 * destructive tone: there is something on this screen to correct. A
 * capability StashBase cannot reach right now is a quiet status instead —
 * shouting at someone about a server they cannot fix only adds noise.
 *
 * The tone and the live-region role move together and are decided here, once.
 * A surface that spells the pair out for itself can get them out of step —
 * a red sentence that announces as a status, or a refusal that announces not
 * at all — and every such surface has to be found again to change the rule.
 * Callers bring their own spacing through `className`; they do not bring their
 * own colour or their own role.
 */
export function FailureLine({
  announce = true,
  as: Tag = 'p',
  children,
  className,
  style,
  tone,
}: {
  /** False when the surface around this line owns its own live region and
   *  announces on its behalf. A second region on one surface does not make a
   *  refusal twice as audible; it makes which one to listen to ambiguous.
   *  The line still carries its tone, because the colour is not the
   *  announcement. */
  announce?: boolean;
  /** `span` for a line that sits inside a row of its own; `p` otherwise. */
  as?: 'p' | 'span';
  children: ReactNode;
  className?: string | undefined;
  /** For a line that has to line up with something measured, such as the
   *  tree's indent. Spacing that is not measured belongs in `className`. */
  style?: CSSProperties | undefined;
  tone: FailureView['tone'];
}) {
  const input = tone === 'input';
  return (
    <Tag
      className={cn(
        'text-caption',
        input ? 'text-destructive' : 'text-muted-foreground',
        className,
      )}
      role={announce ? (input ? 'alert' : 'status') : undefined}
      style={style}
    >
      {children}
    </Tag>
  );
}

/** A `FailureView` said through that line: the sentence the feature wrote,
 *  in the tone it carries. */
export function FailureNotice({
  className,
  failure: { message, tone },
}: {
  className?: string | undefined;
  failure: FailureView;
}) {
  return (
    <FailureLine className={className} tone={tone}>
      {message}
    </FailureLine>
  );
}
