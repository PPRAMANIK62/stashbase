'use client';

import { motion, type HTMLMotionProps } from 'framer-motion';
import { forwardRef, type ReactNode } from 'react';

import { FileThumbnail } from '@/components/ui/file-thumbnail';
import { keyedByContent } from '@/lib/local/keyed-by-content';
import { useShape } from '@/lib/shape-context';
import { useSize, type SizeVariant } from '@/lib/size-context';
import { spring } from '@/lib/springs';
import { useMotionTier } from '@/lib/use-motion-tier';
import { useTouchPrimary } from '@/lib/use-touch-primary';
import { cn } from '@/lib/utils';
import { fileFingerprint } from '@/shared/utils/file-identity';

interface ChatMessageBaseProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  /** Optional attachments rendered as square thumbnails above the bubble. */
  files?: File[];
  /** Side length of each attachment thumbnail in pixels. Defaults to 64. */
  thumbnailSize?: number;
  /** Icon-only action buttons shown in the hover-revealed meta row (e.g. copy,
   *  edit, regenerate). Rendered next to the timestamp. */
  actions?: ReactNode;
  /** Message body. When omitted the text bubble is dropped (attachment-only message). */
  children?: ReactNode;
  /** Pins the message to one step of the size ladder (see /docs/sizes) —
   *  compact tightens bubble type and padding. Omitted, it follows the
   *  surrounding SizeProvider. */
  size?: SizeVariant;
}

/** A timestamp is a user-message affordance. The meta row on an assistant
 *  reply carries its actions and nothing else — so rather than accepting a
 *  `time` there and quietly dropping it, the two roles carry different props
 *  and passing one is a type error. */
interface UserMessageProps extends ChatMessageBaseProps {
  /** Right-aligned accent bubble. */
  from: 'user';
  /** Timestamp shown in the hover-revealed meta row, before the actions.
   *  Caller pre-formats it (e.g. `"Wednesday 6:08 PM"`). */
  time?: ReactNode;
}

interface AssistantMessageProps extends ChatMessageBaseProps {
  /** Left-aligned plain text, no bubble. */
  from: 'assistant';
  time?: never;
}

type ChatMessageProps = UserMessageProps | AssistantMessageProps;

// ─── ChatMessage ──────────────────────────────────────────────────────────
// A single transcript entry with baked-in entrance + layout motion. Pairs with
// InputMessage's onSend: render one per sent/received message. `layout="position"`
// lets earlier messages slide up smoothly when a new one is appended.
const ChatMessage = forwardRef<HTMLDivElement, ChatMessageProps>(
  (
    { from, files, thumbnailSize = 64, time, actions, children, size, className, ...props },
    ref,
  ) => {
    const shape = useShape();
    const compact = useSize(size).variant === 'compact';
    const isUser = from === 'user';
    // Hover-reveal is unreachable on touch — keep the meta row visible there.
    const isTouch = useTouchPrimary();
    const showTime = time != null;

    return (
      <motion.div
        ref={ref}
        layout="position"
        initial={{ opacity: 0, y: 8, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={useMotionTier(spring.moderate)}
        style={{ transformOrigin: isUser ? 'bottom right' : 'bottom left' }}
        className={cn(
          'group flex flex-col gap-1.5',
          isUser ? 'max-w-[72%]' : 'w-full max-w-full',
          isUser ? 'items-end self-end' : 'items-start self-start',
          className,
        )}
        {...props}
      >
        {files && files.length > 0 && (
          <div className={cn('flex flex-wrap gap-1.5', isUser ? 'justify-end' : 'justify-start')}>
            {keyedByContent(files, fileFingerprint).map(({ key, item }) => (
              <FileThumbnail key={key} file={item} size={thumbnailSize} />
            ))}
          </div>
        )}
        {children != null && children !== '' && (
          <div
            className={cn(
              'break-words whitespace-pre-wrap',
              compact ? 'text-[13px]' : 'text-[14px]',
              // Only the bubble carries vertical padding; the flush assistant
              // reply lets the transcript gap set its rhythm.
              isUser && (compact ? 'py-1.5' : 'py-2'),
              // User keeps the bubble chrome (rounded fill + horizontal padding);
              // the assistant reply is flush-left plain text with no background.
              isUser
                ? cn(
                    shape.bg,
                    compact ? 'px-3' : 'px-3.5',
                    // `text-pretty` is reserved for settled user bubbles. On the
                    // assistant reply it's left off on purpose: `text-wrap: pretty`
                    // re-balances the last lines on every content change, so a
                    // word-by-word stream visibly reflows earlier words to new
                    // lines. Default (normal) wrapping appends left-to-right and
                    // stays put as the text grows.
                    'bg-[color-mix(in_oklab,var(--accent),var(--background)_45%)] text-pretty text-accent-foreground',
                  )
                : 'text-foreground',
            )}
          >
            {children}
          </div>
        )}
        {(showTime || actions != null) && (
          // Meta row: timestamp + icon-only actions. Always rendered (so it
          // reserves its height and the gap between bubbles never shifts) but
          // hidden until the message is hovered or an action is focused.
          // Only a user row can carry a timestamp (see the props above), and
          // it reads date → icons left-to-right.
          <div
            className={cn(
              'flex items-center gap-2 px-1 leading-none text-muted-foreground select-none',
              compact ? 'text-[11px]' : 'text-[12px]',
              !isTouch &&
                isUser && [
                  'pointer-events-none opacity-0 transition-opacity duration-base',
                  'group-hover:pointer-events-auto group-hover:opacity-100',
                  'group-focus-within:pointer-events-auto group-focus-within:opacity-100',
                ],
            )}
          >
            {showTime && <span className="tabular-nums">{time}</span>}
            {actions != null && <span className="flex items-center gap-0.5">{actions}</span>}
          </div>
        )}
      </motion.div>
    );
  },
);

ChatMessage.displayName = 'ChatMessage';

export { ChatMessage };
