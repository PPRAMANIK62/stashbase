/** The composer's action bar: the two consumer slots and the one control the
 *  composer owns itself.
 *
 *  That control has three modes and the module derives them rather than being
 *  told — Send while idle, Queue while the assistant is responding and the
 *  draft has something in it, Stop while it is responding and the draft is
 *  empty. Send and Queue share the arrow-up glyph, so only the Stop⇄arrow
 *  swap animates. Slot content is consumer-authored, which is why the compact
 *  step scales every button in the row through a scoped override. */
'use client';

import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { useIcon } from '@/lib/icon-context';
import { useShape } from '@/lib/shape-context';
import { useSize } from '@/lib/size-context';
import { spring } from '@/lib/springs';
import { useMotionTier } from '@/lib/use-motion-tier';
import { cn } from '@/lib/utils';

/** What a slot render function is handed. */
export interface InputMessageSlotContext {
  /** Opens the native file picker via the hidden `<input type="file">`.
   *  Pass `acceptOverride` (e.g. `"image/*"`) to scope the picker to a
   *  subset of the component's accept types just for this invocation. */
  openFilePicker: (acceptOverride?: string) => void;
  /** Currently-attached files (controlled). */
  files: File[];
}

type InputMessageSlot = ReactNode | ((ctx: InputMessageSlotContext) => ReactNode);

/** The slice of `InputMessage`'s public surface this concern owns. */
export interface InputMessageActionProps {
  /** Content rendered in the bottom-left action area. Can be a function that
   *  receives `{ openFilePicker, files }` to wire an attach button. */
  leftSlot?: InputMessageSlot;
  /** Content rendered in the bottom-right action area, before the built-in
   *  send button. Same render-fn shape as leftSlot. */
  rightSlot?: InputMessageSlot;
  /** Accessible label for the send button. */
  sendLabel?: string;
  /** Fired when the Stop control is pressed (streaming, empty draft). The
   *  consumer should halt the current response and flip `status` to `"idle"`,
   *  which immediately dispatches the next queued message. */
  onStop?: () => void;
  /** Lets the consumer send with an empty draft and no files, for a prompt
   *  that carries something else the composer cannot see — a selected skill,
   *  or context bound outside the text. Enter and the send button read the
   *  same predicate, so they never disagree. */
  sendableWithoutText?: boolean;
}

interface ComposerActionsProps {
  /** Bottom-left content, before anything the composer adds. */
  leftSlot: InputMessageSlot;
  /** Bottom-right content, before the built-in send button. */
  rightSlot: InputMessageSlot;
  /** Handed to a slot that is a render function. */
  slotContext: InputMessageSlotContext;
  /** Accessible label for the send button in its Send mode. */
  sendLabel: string;
  /** The composer as a whole is disabled. */
  disabled: boolean | undefined;
  /** The draft carries something worth sending. */
  canSend: boolean;
  /** The assistant is responding. */
  streaming: boolean;
  /** A draft submitted mid-response can be staged instead of sent. */
  queueable: boolean;
  /** Send, or queue while streaming — the same call either way. */
  onSend: () => void;
  /** Halt the current response. Absent means the composer offers no Stop. */
  onStop: (() => void) | undefined;
}

export function ComposerActions({
  leftSlot,
  rightSlot,
  slotContext,
  sendLabel,
  disabled,
  canSend,
  streaming,
  queueable,
  onSend,
  onStop,
}: ComposerActionsProps) {
  const ArrowUpIcon = useIcon('arrow-up');
  const shape = useShape();
  const sizeClasses = useSize();
  const compactStep = sizeClasses.variant === 'compact';
  const swapIn = useMotionTier(spring.fast);
  const swapOut = useMotionTier(spring.fast.exit);

  const mode: 'send' | 'queue' | 'stop' = !streaming
    ? 'send'
    : canSend && queueable
      ? 'queue'
      : onStop
        ? 'stop'
        : 'send';
  const label = mode === 'stop' ? 'Stop' : mode === 'queue' ? 'Queue message' : sendLabel;
  const leftContent = typeof leftSlot === 'function' ? leftSlot(slotContext) : leftSlot;
  const rightContent = typeof rightSlot === 'function' ? rightSlot(slotContext) : rightSlot;

  return (
    <div
      className={cn(
        'flex items-center justify-between',
        // The footer's controls sit one notch below the composer's step:
        // slot content is consumer-authored (usually sm/icon-sm pinned
        // Buttons), so the compact step scales any button in the row —
        // send button included — down to 24px via a scoped override.
        compactStep ? 'gap-1.5' : 'gap-2',
        sizeClasses.nestedControl,
      )}
    >
      <div className="flex min-w-0 items-center gap-1.5">{leftContent}</div>
      <div className="flex shrink-0 items-center gap-1.5">
        {rightContent}
        <Button
          type="button"
          variant="primary"
          size="icon-compact"
          onClick={mode === 'stop' ? () => onStop?.() : onSend}
          disabled={mode === 'stop' ? disabled : !canSend}
          aria-label={label}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={mode === 'stop' ? 'stop' : 'arrow'}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6, transition: swapOut }}
              transition={swapIn}
              className="flex items-center justify-center leading-none"
            >
              {mode === 'stop' ? (
                <span className={`h-3 w-3 ${shape.glyph} bg-current`} />
              ) : (
                // Override icon-sm's small 14px svg — the send glyph reads
                // better a touch larger. `size` matches the attribute to
                // the CSS so the svg box stays centered.
                <ArrowUpIcon
                  size={compactStep ? 15 : 19}
                  className={cn(
                    'block',
                    compactStep ? '!h-[15px] !w-[15px]' : '!h-[19px] !w-[19px]',
                  )}
                />
              )}
            </motion.span>
          </AnimatePresence>
        </Button>
      </div>
    </div>
  );
}
