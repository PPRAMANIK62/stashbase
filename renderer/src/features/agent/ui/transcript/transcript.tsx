import { Check, Copy } from 'lucide-react';
import { Fragment, memo, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { ChatMessage } from '@/components/ui/chat-message';
import { ThinkingIndicator } from '@/components/ui/thinking-indicator';
import type { AgentTranscriptBlock } from '@/features/agent/domain/session';
import {
  dayLabel,
  promptTimeLabel,
  startOfLocalDay,
  transcriptDayBreaks,
} from '@/features/agent/domain/time';

import { AgentActivityGroup, AgentPermissionCard, isAgentToolBlock } from './activity';
import { AgentMarkdown } from './markdown';

const TRANSCRIPT_PAGE_SIZE = 200;

type TranscriptGroup = AgentTranscriptBlock | Extract<AgentTranscriptBlock, { kind: 'tool' }>[];

function CopyReply({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      globalThis.setTimeout(() => setCopied(false), 1_500);
    });
  };
  return (
    <Button
      aria-label={copied ? 'Response copied' : 'Copy response'}
      className="-ml-4"
      leadingIcon={copied ? Check : Copy}
      onClick={copy}
      size="compact"
      variant="ghost"
    >
      {copied ? 'Copied' : 'Copy'}
    </Button>
  );
}

/** Ids of the reply that closes each settled turn: the last assistant block
 *  before the next user prompt. The turn still streaming has none. */
export function copyableReplyIds(blocks: AgentTranscriptBlock[], activeTurn: boolean): Set<string> {
  const ids = new Set<string>();
  let lastReply: string | null = null;
  for (const block of blocks) {
    if (block.kind === 'user') {
      if (lastReply) ids.add(lastReply);
      lastReply = null;
    } else if (block.kind === 'assistant') {
      lastReply = block.id;
    }
  }
  if (lastReply && !activeTurn) ids.add(lastReply);
  return ids;
}

function DayDivider({ at, now }: { at: number; now: number }) {
  const label = dayLabel(startOfLocalDay(at), startOfLocalDay(now));
  return (
    <div
      aria-label={label}
      className="flex items-center gap-3 text-[11px] text-muted-foreground select-none not-first:mt-2"
      role="separator"
    >
      <span aria-hidden className="h-px flex-1 bg-border" />
      {label}
      <span aria-hidden className="h-px flex-1 bg-border" />
    </div>
  );
}

function transcriptGroups(blocks: AgentTranscriptBlock[]): TranscriptGroup[] {
  const groups: TranscriptGroup[] = [];
  let tools: Extract<AgentTranscriptBlock, { kind: 'tool' }>[] = [];
  const flush = () => {
    if (tools.length > 0) groups.push(tools);
    tools = [];
  };
  for (const block of blocks) {
    if (isAgentToolBlock(block) && block.status !== 'awaiting' && !block.permissionRequested) {
      tools.push(block);
      continue;
    }
    flush();
    groups.push(block);
  }
  flush();
  return groups;
}

const TranscriptBlock = memo(function TranscriptBlock({
  block,
  copyable,
  now,
  onOpenExternal,
  onPermission,
  onRetry,
}: {
  block: AgentTranscriptBlock;
  copyable: boolean;
  now: number;
  onOpenExternal(href: string): void;
  onPermission(toolUseId: string, permissionId: string, allow: boolean): boolean;
  onRetry(errorBlockId: string): boolean;
}) {
  if (block.kind === 'user') {
    return (
      <ChatMessage
        className="not-first:mt-4"
        from="user"
        time={block.at === undefined ? undefined : promptTimeLabel(block.at, now)}
      >
        <span className="sr-only">You: </span>
        {block.text}
      </ChatMessage>
    );
  }
  if (block.kind === 'assistant') {
    return (
      <ChatMessage actions={copyable ? <CopyReply text={block.text} /> : undefined} from="assistant">
        <span className="sr-only">Agent: </span>
        <AgentMarkdown markdown={block.text} onOpenExternal={onOpenExternal} />
      </ChatMessage>
    );
  }
  if (block.kind === 'thinking') {
    return (
      <p className="text-[13px] leading-5 text-muted-foreground">{block.text}</p>
    );
  }
  if (block.kind === 'notice') {
    return (
      <p className="border-l border-border pl-3 text-caption text-muted-foreground">{block.text}</p>
    );
  }
  if (block.kind === 'error') {
    return (
      <section className="rounded-md border border-destructive/30 bg-destructive-light p-3">
        <h3 className="text-caption font-medium text-foreground">The Agent could not finish</h3>
        <p className="mt-1 text-caption text-muted-foreground">{block.text}</p>
        {block.retryablePrompt && (
          <Button
            className="mt-2"
            onClick={() => onRetry(block.id)}
            size="compact"
            variant="tertiary"
          >
            Try again
          </Button>
        )}
      </section>
    );
  }
  return <AgentPermissionCard onReply={onPermission} tool={block} />;
});

export const AgentTranscript = memo(function AgentTranscript({
  activeTurn,
  blocks,
  onOpenExternal,
  onPermission,
  onRetry,
}: {
  activeTurn: boolean;
  blocks: AgentTranscriptBlock[];
  onOpenExternal(href: string): void;
  onPermission(toolUseId: string, permissionId: string, allow: boolean): boolean;
  onRetry(errorBlockId: string): boolean;
}) {
  const [visibleCount, setVisibleCount] = useState(TRANSCRIPT_PAGE_SIZE);
  const hiddenCount = Math.max(0, blocks.length - visibleCount);
  const visibleBlocks = blocks.slice(hiddenCount);
  const groups = useMemo(() => transcriptGroups(visibleBlocks), [visibleBlocks]);
  const copyable = useMemo(() => copyableReplyIds(blocks, activeTurn), [activeTurn, blocks]);
  // Time labels refresh with the transcript, not with every render above it.
  const { dayBreaks, now } = useMemo(
    () => ({ dayBreaks: transcriptDayBreaks(visibleBlocks), now: Date.now() }),
    [visibleBlocks],
  );
  const tail = blocks.at(-1);
  const tailNarratesWork = tail?.kind === 'thinking' || tail?.kind === 'tool';

  return (
    <>
      {hiddenCount > 0 && (
        <Button
          className="mx-auto"
          onClick={() => setVisibleCount((count) => count + TRANSCRIPT_PAGE_SIZE)}
          size="compact"
          variant="ghost"
        >
          Show earlier messages
        </Button>
      )}
      {groups.map((group) =>
        Array.isArray(group) ? (
          <AgentActivityGroup key={`activity-${group[0]?.id}`} tools={group} />
        ) : (
          <Fragment key={group.id}>
            {group.kind === 'user' && group.at !== undefined && dayBreaks.has(group.id) && (
              <DayDivider at={group.at} now={now} />
            )}
            <TranscriptBlock
              block={group}
              copyable={copyable.has(group.id)}
              now={now}
              onOpenExternal={onOpenExternal}
              onPermission={onPermission}
              onRetry={onRetry}
            />
          </Fragment>
        ),
      )}
      {activeTurn && !tailNarratesWork && <ThinkingIndicator className="px-0" size="compact" />}
    </>
  );
});
