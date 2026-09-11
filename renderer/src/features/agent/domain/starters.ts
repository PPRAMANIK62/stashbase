/** Top-level names of the folder a Chat is scoped to. Nested entries are
 *  intentionally absent: the prompts point at things the user can see in the
 *  sidebar without expanding anything. */
export interface AgentScopeOutline {
  files: string[];
  folders: string[];
}

/** The three requests a blank Chat cycles through as its placeholder, one for
 *  each thing this space does: build a wiki from the folder, ask it
 *  something, and write from it. They are peers in no order, short enough to
 *  retype and complete enough to send as they are. The durable wiki contract
 *  lives in Agent Instructions, so the first needs no instructions of its
 *  own, and it never becomes "update": the first release claims no built,
 *  ready, or stale wiki state. An empty folder gets none, since there is
 *  nothing yet to build, ask, or write from. */
export function emptyChatPrompts(scopeName: string, outline: AgentScopeOutline): string[] {
  if (outline.files.length === 0 && outline.folders.length === 0) return [];
  return [
    `Build a wiki for ${scopeName}`,
    `What's in ${scopeName}?`,
    `Write a blog post about ${scopeName}`,
  ];
}
