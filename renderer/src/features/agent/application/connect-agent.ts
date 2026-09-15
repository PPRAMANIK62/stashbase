import type { Agent, AgentCatalog } from '@/features/agent/domain/agent-catalog';
import type { AgentId } from '@/features/agent/domain/session';

import type { AgentCatalogPort } from './ports';

function pause(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, 1000);
    signal.addEventListener('abort', abort, { once: true });
  });
}

/** Setup routes acknowledge starting work; only the selected runtime becoming ready finishes it. */
export async function connectAgent(
  port: AgentCatalogPort,
  agent: AgentId,
  known: Agent | undefined,
  signal: AbortSignal,
  wait = pause,
): Promise<void> {
  const bounded = AbortSignal.any([signal, AbortSignal.timeout(10 * 60_000)]);
  const settled = async (catalog: AgentCatalog): Promise<Agent | undefined> => {
    let entry = catalog.agents.find((candidate) => candidate.id === agent);
    while (entry?.preparing) {
      await wait(bounded);
      bounded.throwIfAborted();
      entry = (await port.listAgents(bounded)).agents.find((candidate) => candidate.id === agent);
    }
    return entry;
  };
  const loginFirst = agent === 'codex' && known?.needsSignIn;
  let entry = await settled(
    await port.prepareAgent(agent, loginFirst ? 'login' : 'bootstrap', bounded),
  );
  if (agent === 'codex' && entry?.needsSignIn && !loginFirst) {
    entry = await settled(await port.prepareAgent(agent, 'login', bounded));
  }
  bounded.throwIfAborted();
  if (!entry?.ready)
    throw new Error(
      entry?.setupFailure ?? 'This Agent is not connected yet. Check Agent settings and try again.',
    );
}
