import { api, type AgentsResponse } from './api';
import type { AgentKind } from './agentCatalog';
import type { Action } from './store/state';

/** Fire the New Chat readiness gate without making chat creation wait on a
 * large download. The returned catalog immediately carries installing or
 * ready state; AgentView polls only while work is active. */
export function requestAgentBootstrap(
  agent: AgentKind,
  dispatch: (action: Action) => void,
  onError?: (error: unknown) => void,
): void {
  void api.bootstrapAgent(agent).then((result: AgentsResponse) => {
    dispatch({ type: 'AGENTS_LOADED', agents: result.clis });
  }).catch((error: unknown) => onError?.(error));
}
