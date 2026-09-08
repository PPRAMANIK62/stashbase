import {
  Ban,
  Check,
  ChevronRight,
  CircleAlert,
  FileText,
  FolderOpen,
  Search,
  Terminal,
  Wrench,
} from 'lucide-react';
import { useId, useRef, useState, type ComponentType } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  ThinkingSteps,
  ThinkingStepsContent,
  ThinkingStepsHeader,
} from '@/components/ui/thinking-steps';
import type { AgentTranscriptBlock } from '@/features/agent/domain/session';
import { cn } from '@/lib/utils';

import {
  agentActivitySummary,
  agentPermissionTitle,
  agentToolKind,
  agentToolPayload,
  agentToolResult,
  agentToolRow,
  type AgentToolBlock,
} from './tool-presentation';

type ToolIcon = ComponentType<{ 'aria-hidden'?: boolean; className?: string }>;

const STATUS_LABELS: Record<AgentToolBlock['status'], string> = {
  awaiting: 'Waiting for approval',
  cancelled: 'Cancelled',
  denied: 'Denied',
  done: 'Done',
  error: 'Failed',
  running: 'Running',
};

function iconFor(tool: AgentToolBlock): ToolIcon {
  switch (agentToolKind(tool)) {
    case 'command':
      return Terminal;
    case 'edit':
    case 'write':
      return FileText;
    case 'list':
      return FolderOpen;
    case 'read':
      return FileText;
    case 'search':
      return Search;
    case 'other':
      return Wrench;
  }
}

export function AgentToolPayload({ tool }: { tool: AgentToolBlock }) {
  const payload = agentToolPayload(tool.input);
  const result = tool.result ? agentToolResult(tool.result) : null;
  return (
    <div className="space-y-2 pr-2 pb-2 pl-7 text-[12px] text-muted-foreground">
      <pre
        aria-label={`${tool.name} arguments`}
        className="max-h-72 overflow-auto font-mono break-words whitespace-pre-wrap"
      >
        {payload}
      </pre>
      {result && (
        <pre
          aria-label={`${tool.name} result`}
          className={cn(
            'max-h-72 overflow-auto border-l border-border pl-2 font-mono break-words whitespace-pre-wrap',
            tool.status === 'error' && 'text-destructive',
          )}
        >
          {result}
        </pre>
      )}
    </div>
  );
}

export function AgentToolRow({ tool }: { tool: AgentToolBlock }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const Icon = iconFor(tool);
  const presentation = agentToolRow(tool);
  const hasDetails = Object.keys(tool.input).length > 0 || Boolean(tool.result);
  return (
    <div
      className={cn(
        'rounded-md',
        tool.status === 'error' && 'bg-destructive-light',
        tool.status === 'cancelled' && 'opacity-65',
      )}
    >
      <button
        aria-controls={hasDetails ? panelId : undefined}
        aria-expanded={hasDetails ? open : undefined}
        className={cn(
          'group flex min-h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[12px] outline-none',
          'hover:bg-hover focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]',
          !hasDetails && 'cursor-default',
        )}
        disabled={!hasDetails}
        onClick={() => hasDetails && setOpen((value) => !value)}
        type="button"
      >
        <Icon aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="shrink-0 font-medium text-foreground">{presentation.verb}</span>
        {presentation.target && (
          <span
            className={cn(
              'min-w-0 flex-1 truncate text-muted-foreground',
              presentation.mono && 'font-mono',
            )}
            title={presentation.target}
          >
            {presentation.target}
          </span>
        )}
        <span
          className={cn(
            'ml-auto shrink-0 text-muted-foreground',
            tool.status === 'error' && 'text-destructive',
          )}
        >
          {STATUS_LABELS[tool.status]}
        </span>
        {hasDetails && (
          <ChevronRight
            aria-hidden
            className={cn(
              'size-3 shrink-0 transition-transform motion-reduce:transition-none',
              open && 'rotate-90',
            )}
          />
        )}
      </button>
      {hasDetails && open && (
        <div id={panelId}>
          <AgentToolPayload tool={tool} />
        </div>
      )}
    </div>
  );
}

export function AgentActivityGroup({ tools }: { tools: AgentToolBlock[] }) {
  const active = tools.some((tool) => tool.status === 'running');
  return (
    <ThinkingSteps className="-ml-2 w-[calc(100%+0.5rem)]" defaultOpen={false}>
      <ThinkingStepsHeader className="px-2 py-1.5 text-[13px]">
        {agentActivitySummary(tools, active)}
      </ThinkingStepsHeader>
      <ThinkingStepsContent className="gap-0.5 pl-2">
        {tools.map((tool) => (
          <AgentToolRow key={tool.id} tool={tool} />
        ))}
      </ThinkingStepsContent>
    </ThinkingSteps>
  );
}

export function AgentPermissionCard({
  tool,
  onReply,
}: {
  tool: AgentToolBlock;
  onReply(toolUseId: string, permissionId: string, allow: boolean): boolean;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const permissionId = tool.permissionId;
  const reply = (allow: boolean) => {
    if (!permissionId || !onReply(tool.id, permissionId, allow)) return;
    requestAnimationFrame(() => headingRef.current?.focus());
  };
  return (
    <Card className="border border-decision/30 bg-decision-soft/45 shadow-sm">
      <div className="p-3">
        <div className="flex items-start gap-2">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-decision" />
          <h3
            className="text-[13px] font-medium text-foreground outline-none"
            ref={headingRef}
            tabIndex={-1}
          >
            {agentPermissionTitle(tool)}
          </h3>
        </div>
        <AgentToolPayload tool={tool} />
        {permissionId ? (
          <div className="mt-1 flex justify-end gap-2">
            <Button
              leadingIcon={Ban}
              onClick={() => reply(false)}
              size="compact"
              variant="tertiary"
            >
              Reject
            </Button>
            <Button leadingIcon={Check} onClick={() => reply(true)} size="compact">
              Allow
            </Button>
          </div>
        ) : (
          <p className="mt-1 text-right text-[12px] text-muted-foreground" role="status">
            {STATUS_LABELS[tool.status]}
          </p>
        )}
      </div>
    </Card>
  );
}

export function isAgentToolBlock(block: AgentTranscriptBlock): block is AgentToolBlock {
  return block.kind === 'tool';
}
