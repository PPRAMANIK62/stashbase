import { useEffect, useLayoutEffect, useRef } from 'react';

import type { AgentContextPort, AgentSessionPort } from '@/features/agent/application/ports';
import type { AgentFilesChanged } from '@/features/agent/application/session-runtime';
import {
  createAgentWorkspaceRuntime,
  type AgentWorkspaceRuntime,
} from '@/features/agent/application/workspace-runtime';
import { useRetainedRuntime } from '@/shared/runtime/use-retained-runtime';

export interface AgentWorkspaceRuntimeOptions {
  context: AgentContextPort;
  createId(): string;
  folderPath: string | null;
  /** Files an Agent's settled write changed; the latest handler is called. */
  onFilesChanged?: (change: AgentFilesChanged) => void;
  session: AgentSessionPort;
  subscribeFolderRemoved(handler: (folderPath: string) => void): () => void;
}

/** Owns the Agent workspace for one renderer window. Blank drafts stay local;
 * the catalog readiness gate allows the first turn to start transport. */
export function useAgentWorkspaceRuntime({
  context,
  createId,
  folderPath,
  onFilesChanged,
  session,
  subscribeFolderRemoved,
}: AgentWorkspaceRuntimeOptions): AgentWorkspaceRuntime {
  const filesChangedHandler = useRef(onFilesChanged);
  filesChangedHandler.current = onFilesChanged;
  const runtime = useRetainedRuntime(
    () =>
      createAgentWorkspaceRuntime({
        autostart: false,
        context,
        createId,
        folderPath,
        onFilesChanged: (change) => filesChangedHandler.current?.(change),
        port: session,
      }),
    (agent) => agent.dispose(),
  );

  useLayoutEffect(() => runtime.setWindowFolder(folderPath), [folderPath, runtime]);
  useEffect(
    () => subscribeFolderRemoved((path) => runtime.retireFolder(path)),
    [runtime, subscribeFolderRemoved],
  );

  return runtime;
}
