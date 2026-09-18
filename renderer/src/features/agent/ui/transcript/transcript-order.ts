import type { AgentTranscriptBlock } from '@/features/agent/domain/session';

/** The last assistant reply of each settled turn and its prompt time. */
export function closingReplies(
  blocks: AgentTranscriptBlock[],
  activeTurn: boolean,
): Map<string, number | undefined> {
  const replies = new Map<string, number | undefined>();
  let promptAt: number | undefined;
  let lastReply: string | null = null;
  for (const block of blocks) {
    if (block.kind === 'user') {
      if (lastReply) replies.set(lastReply, promptAt);
      lastReply = null;
      promptAt = block.at;
    } else if (block.kind === 'assistant') {
      lastReply = block.id;
    }
  }
  if (lastReply && !activeTurn) replies.set(lastReply, promptAt);
  return replies;
}
