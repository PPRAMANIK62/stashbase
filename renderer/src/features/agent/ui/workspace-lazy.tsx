import { lazy, Suspense, useState } from 'react';

import type { AgentCatalogPort } from '@/features/agent/application/ports';
import type { AgentWorkspaceRuntime } from '@/features/agent/application/workspace-runtime';
import type { AgentScope } from '@/features/agent/domain/session';

import { AgentSurfaceBoundary } from './agent-surface-boundary';

export interface AgentWorkspaceProps {
  catalog: AgentCatalogPort;
  onOpenAgentSettings(): void;
  runtime: AgentWorkspaceRuntime;
  withDocuments: boolean;
}

export interface AgentChatsProps {
  catalog: AgentCatalogPort;
  onOpenAgentSettings(): void;
  runtime: AgentWorkspaceRuntime;
  scope: AgentScope;
  workspaceName: string;
}

const loadWorkspace = () => import('./workspace');
const loadChats = () => import('./chats');

export function AgentWorkspace(props: AgentWorkspaceProps) {
  const [Workspace, setWorkspace] = useState(() => lazy(loadWorkspace));
  return (
    <AgentSurfaceBoundary onRetry={() => setWorkspace(lazy(loadWorkspace))}>
      <Suspense fallback={<div className="h-full bg-surface-2" />}>
        <Workspace {...props} />
      </Suspense>
    </AgentSurfaceBoundary>
  );
}

export function AgentChats(props: AgentChatsProps) {
  const [Chats, setChats] = useState(() => lazy(loadChats));
  return (
    <AgentSurfaceBoundary onRetry={() => setChats(lazy(loadChats))}>
      <Suspense
        fallback={<p className="px-4 py-2 text-caption text-muted-foreground">Loading chats…</p>}
      >
        <Chats {...props} />
      </Suspense>
    </AgentSurfaceBoundary>
  );
}
