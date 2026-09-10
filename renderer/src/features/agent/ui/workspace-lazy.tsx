import type { ReactNode } from 'react';

import { SURFACE_FAILED } from '@/features/agent/application/failure-messages';
import type { AgentCatalogPort, AgentInstructionsPort } from '@/features/agent/application/ports';
import type { AgentWorkspaceRuntime } from '@/features/agent/application/workspace-runtime';
import type { AgentScope } from '@/features/agent/domain/session';
import type { AgentScopeOutline } from '@/features/agent/domain/starters';
import type { SourceReference } from '@/shared/domain/source-reference';
import { lazySurface } from '@/shared/runtime/lazy-surface';
import { SurfaceBoundary } from '@/shared/runtime/surface-boundary';

export interface AgentWorkspaceProps {
  catalog: AgentCatalogPort;
  /** The standing instructions this scope's Chats run under. */
  instructions: AgentInstructionsPort;
  onOpenExternal(href: string): void;
  onOpenAgentSettings(): void;
  /** Opens a file the Agent changed beside the chat; the user chose it. */
  onOpenSource?: ((source: SourceReference) => void) | undefined;
  /** Restarts preparation for a bound source whose prepared text failed. */
  onReprocess?: ((source: SourceReference) => void) | undefined;
  runtime: AgentWorkspaceRuntime;
  /** Top-level entries of the scoped folder, or null while unknown. Seeds the
   *  empty chat's starter prompts. */
  scopeOutline: AgentScopeOutline | null;
}

export interface AgentChatsProps {
  catalog: AgentCatalogPort;
  onOpenAgentSettings(): void;
  runtime: AgentWorkspaceRuntime;
  scope: AgentScope;
  workspaceName: string;
}

/** Both Agent surfaces load behind the same boundary, so a chunk that fails
 *  offers a retry instead of taking the shell down with it. One factory, so
 *  the panel and the sidebar's chats cannot drift into two recoveries; the
 *  wording is the feature's, and only the placement is this file's. */
const agentBoundary = (retry: () => void, children: ReactNode) => (
  <SurfaceBoundary
    placement="pane"
    recovery={{ actions: [{ label: 'Retry', perform: retry }], message: SURFACE_FAILED }}
    surface="Agent"
  >
    {children}
  </SurfaceBoundary>
);

export const AgentWorkspace = lazySurface<AgentWorkspaceProps>(() => import('./workspace'), {
  boundary: agentBoundary,
  fallback: <div className="h-full bg-surface-2" />,
});

export const AgentChats = lazySurface<AgentChatsProps>(() => import('./chats/chats'), {
  boundary: agentBoundary,
  fallback: <p className="px-4 py-2 text-caption text-muted-foreground">Loading chats…</p>,
});
