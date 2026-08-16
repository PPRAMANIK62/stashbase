/**
 * Chat slice: the right-side Agent Panel's tab bookkeeping. See the slice
 * map atop `state.ts`. Kept independent of `WorkspaceContext` so opening or
 * typing in a chat tab never re-renders the sidebar/file-tree/tab-strip,
 * and vice versa.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { State } from './state';

export interface ChatState {
  chatOpen: State['chatOpen'];
  chatWidth: State['chatWidth'];
  agents: State['agents'];
  chatTabs: State['chatTabs'];
  activeChatTabId: State['activeChatTabId'];
  chatTabRecencyByAgent: State['chatTabRecencyByAgent'];
  pendingResume: State['pendingResume'];
}

export const ChatContext = createContext<ChatState | null>(null);

export function ChatProvider({ state, children }: { state: State; children: ReactNode }) {
  const value = useMemo<ChatState>(() => ({
    chatOpen: state.chatOpen,
    chatWidth: state.chatWidth,
    agents: state.agents,
    chatTabs: state.chatTabs,
    activeChatTabId: state.activeChatTabId,
    chatTabRecencyByAgent: state.chatTabRecencyByAgent,
    pendingResume: state.pendingResume,
  }), [
    state.chatOpen, state.chatWidth, state.agents, state.chatTabs,
    state.activeChatTabId, state.chatTabRecencyByAgent, state.pendingResume,
  ]);
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat(): ChatState {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used inside <ChatProvider>');
  return ctx;
}
