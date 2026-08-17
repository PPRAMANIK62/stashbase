import assert from 'node:assert/strict';
import test from 'node:test';
import { api, type AgentsResponse } from '@/common/api/api';
import { newChatPlan } from '@/store/lib/chatTabPlan';

test('switching a blank Codex tab to Claude does not install Claude before confirmation', async () => {
  const originalBootstrap = api.bootstrapAgent;
  const requested: string[] = [];
  api.bootstrapAgent = async (agent): Promise<AgentsResponse> => {
    requested.push(agent);
    return { clis: [] };
  };
  try {
    const plan = newChatPlan(
      [{ id: 'codex-blank', agent: 'codex', blank: true }],
      'claude',
    );
    await Promise.resolve();

    assert.deepEqual(plan, { kind: 'reuse', id: 'codex-blank', switchAgent: true });
    assert.deepEqual(requested, []);
  } finally {
    api.bootstrapAgent = originalBootstrap;
  }
});
