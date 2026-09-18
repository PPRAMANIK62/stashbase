import { expect, it, vi } from 'vite-plus/test';

import { agentCatalogPort, CLAUDE_AGENT } from '@/test/fakes/agent';

import { updateAgent } from './connect-agent';
import { agentUpdateFailure } from './failure-messages';

const immediately = async () => undefined;

it('follows the update acknowledgement until the runtime is ready again', async () => {
  const preparing = { ...CLAUDE_AGENT, preparing: true, ready: false };
  const ready = { ...CLAUDE_AGENT, preparing: false, ready: true };
  const port = agentCatalogPort([ready], {
    prepareAgent: vi.fn(async () => ({ agents: [preparing] })),
  });

  await expect(
    updateAgent(port, 'claude', new AbortController().signal, immediately),
  ).resolves.toBeUndefined();

  expect(port.prepareAgent).toHaveBeenCalledWith('claude', 'update', expect.anything());
  expect(port.listAgents).toHaveBeenCalledOnce();
});

it("reports the service's own sentence when the update does not end ready", async () => {
  const failed = {
    ...CLAUDE_AGENT,
    preparing: false,
    ready: false,
    setupFailure: 'npm global folder is not writable',
  };
  const port = agentCatalogPort([failed], {
    prepareAgent: vi.fn(async () => ({ agents: [failed] })),
  });

  await expect(
    updateAgent(port, 'claude', new AbortController().signal, immediately),
  ).rejects.toSatisfy((error) => agentUpdateFailure(error) === 'npm global folder is not writable');
});
