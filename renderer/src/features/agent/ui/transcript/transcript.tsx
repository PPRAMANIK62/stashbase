/** The conversation as it reads: prompts, replies, thinking, notices and
 *  activity groups in order, with day breaks between prompts and a copy
 *  affordance on the last settled reply. Blocks arrive already shaped by the
 *  session domain; this module only decides how each one is presented. */
import { Check, Copy } from 'lucide-react';
import { Fragment, memo, useCallback, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { ChatMessage } from '@/components/ui/chat-message';
import { FileTypeIcon } from '@/components/ui/file-type-icon';
import { ThinkingIndicator } from '@/components/ui/thinking-indicator';
import { segmentFileMentions, type AgentContextItem } from '@/features/agent/domain/context';
import type { AgentTranscriptBlock } from '@/features/agent/domain/session';
import {
  dayLabel,
  promptTimeLabel,
  startOfLocalDay,
  transcriptDayBreaks,
} from '@/features/agent/domain/time';
import { SentContextTiles } from '@/features/agent/ui/composer/context-tiles';
import type { SourceReference } from '@/shared/domain/source-reference';

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
    // Only an ask still waiting stands alone; a decided one is ordinary
    // settled work and folds into the group, where its row stays inspectable.
    if (isAgentToolBlock(block) && block.status !== 'awaiting') {
      tools.push(block);
      continue;
    }
    flush();
    groups.push(block);
  }
  flush();
  return groups;
}

/** Context as it was sent, or the replayed attachments a native history
 *  record kept when this renderer never bound them. */
function sentContext(block: Extract<AgentTranscriptBlock, { kind: 'user' }>): AgentContextItem[] {
  if (block.context) return block.context;
  return (block.attachments ?? []).map((attachment) => ({
    dims: attachment.dims,
    kind: 'transient',
    name: attachment.name,
    path: attachment.path,
    previewUrl: attachment.previewUrl,
  }));
}

const TranscriptBlock = memo(function TranscriptBlock({
  block,
  copyable,
  now,
  onOpenExternal,
  onPermission,
  onRetry,
  transientFile,
}: {
  block: AgentTranscriptBlock;
  copyable: boolean;
  now: number;
  onOpenExternal(href: string): void;
  onPermission(toolUseId: string, permissionId: string, allow: boolean): boolean;
  onRetry(errorBlockId: string): boolean;
  transientFile?: ((path: string) => File | undefined) | undefined;
}) {
  if (block.kind === 'user') {
    const context = sentContext(block);
    const transientPaths = context.flatMap((item) =>
      item.kind === 'transient' ? [item.path] : [],
    );
    const segments = segmentFileMentions(block.text, transientPaths);
    const mentioned = new Set(
      segments.flatMap((segment) => (segment.kind === 'mention' ? [segment.path] : [])),
    );
    // A source the text already mentions inline is not repeated as a tile;
    // only sources bound without a mention, such as a dropped row, get one.
    const tiles = context.filter(
      (item) => item.kind !== 'source' || !mentioned.has(item.source.path),
    );
    return (
      <div className="flex max-w-[72%] flex-col items-end gap-1.5 self-end not-first:mt-4">
        <SentContextTiles fileFor={transientFile} items={tiles} />
        <ChatMessage
          className="max-w-full"
          from="user"
          time={block.at === undefined ? undefined : promptTimeLabel(block.at, now)}
        >
          <span className="sr-only">You: </span>
          {segments.map((segment) =>
            segment.kind === 'text' ? (
              segment.text
            ) : (
              <span
                className="mx-px inline-flex max-w-full items-center gap-1 rounded-md bg-foreground/8 px-1.5 py-px align-baseline font-medium"
                key={`${segment.start}:${segment.path}`}
                title={segment.path}
              >
                <FileTypeIcon
                  aria-hidden="true"
                  className="shrink-0"
                  path={segment.path}
                  size={12}
                />
                <span className="truncate">
                  {segment.path.slice(segment.path.lastIndexOf('/') + 1)}
                </span>
                <span className="sr-only"> (file mention: {segment.path})</span>
              </span>
            ),
          )}
        </ChatMessage>
      </div>
    );
  }
  if (block.kind === 'assistant') {
    return (
      <ChatMessage
        actions={copyable ? <CopyReply text={block.text} /> : undefined}
        from="assistant"
      >
        <span className="sr-only">Agent: </span>
        <AgentMarkdown markdown={block.text} onOpenExternal={onOpenExternal} />
      </ChatMessage>
    );
  }
  if (block.kind === 'thinking') {
    return <p className="text-[13px] leading-5 text-muted-foreground">{block.text}</p>;
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
        {block.retryablePrompt !== undefined && (
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
  onOpenSource,
  onPermission,
  onRetry,
  sourceFor,
  transientFile,
}: {
  activeTurn: boolean;
  blocks: AgentTranscriptBlock[];
  onOpenExternal(href: string): void;
  /** Opens a file the Agent changed beside the chat, without selecting it
   *  on the Agent's behalf. */
  onOpenSource?: ((source: SourceReference) => void) | undefined;
  onPermission(toolUseId: string, permissionId: string, allow: boolean): boolean;
  onRetry(errorBlockId: string): boolean;
  /** The workspace source behind a changed path, or null when it is not one. */
  sourceFor?: ((path: string) => SourceReference | null) | undefined;
  /** The File behind a sent upload, when this session still holds it. */
  transientFile?: ((path: string) => File | undefined) | undefined;
}) {
  const [visibleCount, setVisibleCount] = useState(TRANSCRIPT_PAGE_SIZE);
  // The ask's card leaves the transcript on decision, so focus follows the
  // decided tool into the activity group that now holds it.
  const [decidedToolId, setDecidedToolId] = useState<string | null>(null);
  const decide = useCallback(
    (toolUseId: string, permissionId: string, allow: boolean) => {
      const accepted = onPermission(toolUseId, permissionId, allow);
      if (accepted) setDecidedToolId(toolUseId);
      return accepted;
    },
    [onPermission],
  );
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
          <AgentActivityGroup
            focusToolId={decidedToolId}
            key={`activity-${group[0]?.id}`}
            onOpenSource={onOpenSource}
            sourceFor={sourceFor}
            tools={group}
          />
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
              onPermission={decide}
              onRetry={onRetry}
              transientFile={transientFile}
            />
          </Fragment>
        ),
      )}
      {activeTurn && !tailNarratesWork && <ThinkingIndicator className="px-0" size="compact" />}
    </>
  );
});
