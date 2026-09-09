import { useEffect, useState } from 'react';

export interface BootProgressOptions {
  /** How many folders the library holds; zero until one is authorized. */
  memberCount: number;
  /** True once the library has loaded and no folder restore is still running. */
  settled: boolean;
}

/**
 * Startup signalling for the window: when the first paint is trustworthy, and
 * when the Agent surface is allowed to exist.
 *
 * `data-boot-settled` on the body is what the desktop harness and the E2E
 * journeys wait on, so it is set exactly once the library has answered and no
 * folder restore is still in flight — earlier and a screenshot catches a
 * half-built shell. The Agent latch is separate and one-way: once a library has
 * ever held a folder the Agent workspace stays mounted, so emptying the library
 * does not tear down a running conversation.
 */
export function useBootProgress({ memberCount, settled }: BootProgressOptions): boolean {
  const [agentStarted, setAgentStarted] = useState(false);

  useEffect(() => {
    if (!settled) return;
    document.body.dataset.bootSettled = '1';
  }, [settled]);

  useEffect(() => {
    if (memberCount > 0) setAgentStarted(true);
  }, [memberCount]);

  return agentStarted;
}
