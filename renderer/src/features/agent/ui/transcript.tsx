import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { ChatMessage } from '@/components/ui/chat-message';
import type { AgentTranscriptBlock } from '@/features/agent/domain/session';

const TRANSCRIPT_PAGE_SIZE = 200;

function TranscriptBlock({ block }: { block: AgentTranscriptBlock }) {
  if (block.kind === 'user' || block.kind === 'assistant') {
    return <ChatMessage from={block.kind}>{block.text}</ChatMessage>;
  }
  if (block.kind === 'thinking') {
    return <p className="text-caption text-muted-foreground">{block.text}</p>;
  }
  return (
    <div className="rounded-md border border-border bg-surface-3 px-3 py-2 text-caption">
      <span className="font-medium text-foreground">{block.name}</span>
      <span className="ml-2 text-muted-foreground">{block.status}</span>
      {block.result && (
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-muted-foreground">
          {block.result}
        </pre>
      )}
    </div>
  );
}

export function AgentTranscript({ blocks }: { blocks: AgentTranscriptBlock[] }) {
  const [visibleCount, setVisibleCount] = useState(TRANSCRIPT_PAGE_SIZE);
  const hiddenCount = Math.max(0, blocks.length - visibleCount);
  const visibleBlocks = blocks.slice(hiddenCount);

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
      {visibleBlocks.map((block) => (
        <TranscriptBlock block={block} key={block.id} />
      ))}
    </>
  );
}
