/** Back and forward through this project’s actual chat visits. */
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useStore } from 'zustand';

import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import type { AgentWorkspaceRuntime } from '@/features/agent/application/workspace-runtime';
import { agentVisitTarget } from '@/features/agent/domain/workspace';
import { useSizeVariant } from '@/lib/size-context';

export function ChatNavButtons({ runtime }: { runtime: AgentWorkspaceRuntime }) {
  // The same size rule as the sidebar trigger beside the pair, so the three
  // glyphs read as one row.
  const size = useSizeVariant() === 'compact' ? ('icon-compact' as const) : ('icon' as const);
  const state = useStore(runtime.store);
  const previous = agentVisitTarget(state, -1);
  const next = agentVisitTarget(state, 1);
  return (
    <>
      <Tooltip content="Previous chat" side="bottom">
        <Button
          aria-label="Previous chat"
          className="ml-1"
          disabled={previous === null}
          onClick={() => {
            runtime.visit(-1);
          }}
          size={size}
          variant="ghost"
        >
          <ArrowLeft aria-hidden="true" />
        </Button>
      </Tooltip>
      <Tooltip content="Next chat" side="bottom">
        <Button
          aria-label="Next chat"
          className="ml-1"
          disabled={next === null}
          onClick={() => {
            runtime.visit(1);
          }}
          size={size}
          variant="ghost"
        >
          <ArrowRight aria-hidden="true" />
        </Button>
      </Tooltip>
    </>
  );
}
