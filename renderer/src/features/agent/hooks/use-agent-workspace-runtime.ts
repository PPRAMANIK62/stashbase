import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import type { AgentSessionPort } from '@/features/agent/application/ports';
import {
  createAgentWorkspaceRuntime,
  type AgentWorkspaceRuntime,
} from '@/features/agent/application/workspace-runtime';

export interface AgentWorkspaceRuntimeOptions {
  createId(): string;
  folderPath: string | null;
  session: AgentSessionPort;
  subscribeFolderRemoved(handler: (folderPath: string) => void): () => void;
}

/** Owns the Agent workspace for one renderer window. Blank drafts stay local;
 * the catalog readiness gate allows the first turn to start transport. */
export function useAgentWorkspaceRuntime({
  createId,
  folderPath,
  session,
  subscribeFolderRemoved,
}: AgentWorkspaceRuntimeOptions): AgentWorkspaceRuntime {
  const [runtime] = useState(() =>
    createAgentWorkspaceRuntime({
      autostart: false,
      createId,
      folderPath,
      port: session,
    }),
  );
  const mountCount = useRef(0);

  useEffect(() => {
    mountCount.current += 1;
    return () => {
      mountCount.current -= 1;
      queueMicrotask(() => {
        if (mountCount.current === 0) runtime.dispose();
      });
    };
  }, [runtime]);

  useLayoutEffect(() => runtime.setWindowFolder(folderPath), [folderPath, runtime]);
  useEffect(
    () => subscribeFolderRemoved((path) => runtime.retireFolder(path)),
    [runtime, subscribeFolderRemoved],
  );

  return runtime;
}
