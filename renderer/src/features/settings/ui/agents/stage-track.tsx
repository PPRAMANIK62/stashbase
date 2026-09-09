import type { AgentRuntimeStage } from '@/features/settings/domain/agent-catalog';
import { agentRuntimeStageIndex } from '@/features/settings/domain/agent-runtime-status';
import { cn } from '@/lib/utils';

export interface StageTrackProps {
  /** The stage the runtime is standing on; its track position is derived. */
  stage: AgentRuntimeStage;
  failed: boolean;
}

const SEGMENTS: ReadonlyArray<{ key: AgentRuntimeStage; label: string }> = [
  { key: 'discover', label: 'Discover' },
  { key: 'install', label: 'Install' },
  { key: 'authenticate', label: 'Authenticate' },
  { key: 'configure', label: 'Configure' },
];

/**
 * The staged-preparation track: `discover → install → authenticate →
 * configure`, filling as `AgentBootstrapStatus.phase` advances instead of an
 * indeterminate spinner. `discover` at rest (not yet attempted, not failed)
 * lights nothing — there is no live segment to animate until a bootstrap
 * attempt actually starts.
 */
export function StageTrack({ stage, failed }: StageTrackProps) {
  const activeIndex = stage === 'discover' && !failed ? null : agentRuntimeStageIndex(stage);

  return (
    <div className="mt-2">
      <div className="flex items-center gap-[3px]" role="presentation">
        {SEGMENTS.map((segment, index) => {
          const done = activeIndex !== null && index < activeIndex;
          const current = activeIndex === index;
          return (
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted" key={segment.key}>
              <div
                className={cn(
                  'h-full origin-left rounded-full transition-transform duration-slow ease-out',
                  done && 'scale-x-100 bg-foreground',
                  current && !failed && 'scale-x-100 bg-[color:var(--focus-ring)]',
                  current && failed && 'scale-x-100 bg-destructive',
                  !done && !current && 'scale-x-0',
                )}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between">
        {SEGMENTS.map((segment, index) => (
          <span
            className={cn(
              'text-[9.5px] tracking-wide text-muted-foreground',
              activeIndex !== null && index < activeIndex && 'text-foreground',
              activeIndex === index && !failed && 'font-semibold text-[color:var(--focus-ring)]',
              activeIndex === index && failed && 'font-semibold text-destructive',
            )}
            key={segment.key}
          >
            {segment.label}
          </span>
        ))}
      </div>
    </div>
  );
}
