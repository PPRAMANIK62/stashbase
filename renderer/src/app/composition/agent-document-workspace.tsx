/**
 * The Agent beside the open document, and the handle between them.
 *
 * Both panes are always mounted: the Agent keeps its transcript and its
 * composer draft while a document is opened and closed beside it, so the split
 * is a width, not a route. The Agent pane's width is the remembered one; the
 * document keeps a floor of its own and the Agent yields, which is what makes
 * a narrow window collapse the chat rather than crush the page being read.
 */
import { motion, useReducedMotion } from 'framer-motion';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

import { SplitHandle } from '@/components/ui/split-handle';
import { useHasOpenDocuments, type DocumentTabsRuntime } from '@/features/documents/public';
import { AGENT_PANE_WIDTH } from '@/features/workspace/public';
import { spring } from '@/lib/springs';

/** The document keeps at least this much of the row; the Agent pane yields. */
const MIN_DOCUMENT_WIDTH = 320;

/** The row's own width in px, or null until it has been measured. */
function useRowWidth(ref: React.RefObject<HTMLDivElement | null>): number | null {
  const [width, setWidth] = useState<number | null>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setWidth(element.getBoundingClientRect().width || null);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

/**
 * One row that is always mounted: the document slot on the left and the
 * Agent pane on the right. With no document open the slot is zero wide and
 * the Agent has the whole row; opening the first document only changes
 * widths, so the Agent workspace never remounts and keeps its transcript,
 * draft, and focus.
 *
 * Motion follows "clip, don't reflow": both panes' contents sit at their
 * final widths from the first frame, and only the seam between them moves,
 * so nothing re-lays out mid-flight. Dragging the seam stays instant.
 */
export function AgentDocumentWorkspace({
  agent,
  document,
  onPaneWidthChange,
  paneWidth,
  runtime,
}: {
  agent: ReactNode;
  document: ReactNode;
  onPaneWidthChange(width: number): void;
  paneWidth: number;
  runtime: DocumentTabsRuntime | null;
}) {
  const hasDocuments = useHasOpenDocuments(runtime);
  const rowRef = useRef<HTMLDivElement>(null);
  const rowWidth = useRowWidth(rowRef);
  const reduceMotion = useReducedMotion() ?? false;

  // The seam animates only when a document opens or the last one closes;
  // every other width change (a drag, a window resize) lands at once.
  const previous = useRef(hasDocuments);
  const [settling, setSettling] = useState(false);
  useLayoutEffect(() => {
    if (previous.current === hasDocuments) return;
    previous.current = hasDocuments;
    if (!reduceMotion && rowWidth !== null) setSettling(true);
  }, [hasDocuments, reduceMotion, rowWidth]);

  const agentWidth = hasDocuments
    ? rowWidth === null
      ? paneWidth
      : Math.min(paneWidth, Math.max(AGENT_PANE_WIDTH.min, rowWidth - MIN_DOCUMENT_WIDTH))
    : null;
  const documentWidth =
    agentWidth === null
      ? 0
      : rowWidth === null
        ? `calc(100% - ${agentWidth}px)`
        : rowWidth - agentWidth;
  // While the last document's slot closes, the Agent keeps its docked width
  // pinned to the right so the seam sweeps over empty space instead of
  // reflowing the transcript on every frame; it takes the row once settled.
  const lastAgentWidth = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (agentWidth !== null) lastAgentWidth.current = agentWidth;
  }, [agentWidth]);
  const pinnedAgentWidth = agentWidth ?? (settling ? lastAgentWidth.current : null);

  return (
    <div className="flex h-full min-h-0 overflow-hidden" ref={rowRef}>
      <motion.div
        animate={{ width: documentWidth }}
        aria-hidden={!hasDocuments}
        className="relative h-full shrink-0 overflow-hidden"
        data-testid="document-slot"
        initial={false}
        onAnimationComplete={() => setSettling(false)}
        transition={settling ? spring.moderate : { duration: 0 }}
      >
        <motion.div
          animate={{ opacity: hasDocuments ? 1 : 0 }}
          className="h-full"
          initial={false}
          style={{ width: typeof documentWidth === 'number' ? documentWidth || undefined : '100%' }}
          transition={settling ? spring.fast : { duration: 0 }}
        >
          {document}
        </motion.div>
      </motion.div>
      <div className="relative h-full min-w-0 flex-1 overflow-hidden">
        {hasDocuments && (
          <SplitHandle
            className="left-0 -translate-x-1/2"
            defaultWidth={AGENT_PANE_WIDTH.default}
            label="Resize Agent pane"
            max={AGENT_PANE_WIDTH.max}
            min={AGENT_PANE_WIDTH.min}
            onWidthChange={onPaneWidthChange}
            pane="right"
            width={paneWidth}
          />
        )}
        <div
          className={pinnedAgentWidth === null ? 'h-full' : 'ml-auto h-full border-l border-border'}
          data-testid="agent-pane"
          style={pinnedAgentWidth === null ? undefined : { width: pinnedAgentWidth }}
        >
          {agent}
        </div>
      </div>
    </div>
  );
}
