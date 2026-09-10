import assert from 'node:assert/strict';
import test from 'node:test';

import {
  agentRuntimeDebugPatchRequestSchema,
  agentRuntimeFailureSchema,
  agentsResponseSchema,
  hostedAgentAllowanceSchema,
} from './agent-runtime.ts';

test('agents response accepts a mixed catalog of installed, mid-bootstrap, and failed runtimes', () => {
  const result = agentsResponseSchema.parse({
    clis: [
      {
        id: 'stashbase',
        label: 'Built-in',
        vendor: 'StashBase',
        installHint: '',
        installed: true,
        source: 'bundled',
        bootstrap: { phase: 'ready' },
        launchCommand: 'stashbase',
      },
      {
        id: 'codex',
        label: 'Codex',
        vendor: 'OpenAI',
        installHint: 'npm install -g codex',
        installed: false,
        bootstrap: { phase: 'idle' },
        launchCommand: 'codex',
      },
      {
        id: 'claude',
        label: 'Claude Code',
        vendor: 'Anthropic',
        installHint: 'curl -fsSL https://claude.ai/install.sh | bash',
        installed: true,
        source: 'system',
        bootstrap: {
          phase: 'failed',
          failure: {
            stage: 'authentication',
            code: 'authentication-required',
            message: 'Sign in required.',
            retryable: true,
          },
        },
        launchCommand: 'claude',
      },
    ],
    debug: {
      enabled: true,
      discoveryPolicy: 'auto',
      nextFailure: 'none',
      nextTurnFailure: 'none',
    },
  });
  assert.equal(result.clis.length, 3);
  assert.equal(result.clis[2]?.bootstrap?.failure?.code, 'authentication-required');
});

test('agents response rejects an unlisted field', () => {
  assert.equal(
    agentsResponseSchema.safeParse({
      clis: [],
      unexpected: true,
    }).success,
    false,
  );
});

test('debug patch accepts a partial update and rejects an unknown field', () => {
  assert.equal(
    agentRuntimeDebugPatchRequestSchema.safeParse({ discoveryPolicy: 'managed-only' }).success,
    true,
  );
  assert.equal(agentRuntimeDebugPatchRequestSchema.safeParse({}).success, true);
  assert.equal(agentRuntimeDebugPatchRequestSchema.safeParse({ enabled: true }).success, false);
});

test('agent runtime failure keeps an unlisted field and requires a non-empty error', () => {
  const parsed = agentRuntimeFailureSchema.safeParse({ error: 'unavailable', extra: 'kept' });
  assert.equal(parsed.success, true);
  assert.equal(parsed.success && parsed.data.extra, 'kept');
  assert.equal(agentRuntimeFailureSchema.safeParse({ error: '' }).success, false);
});

test('hosted agent allowance allows a not-yet-started window', () => {
  assert.equal(
    hostedAgentAllowanceSchema.parse({
      profile: 'stashbase-agent-default',
      remainingPercent: 100,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      windowStartedAt: null,
      windowEndsAt: null,
    }).windowStartedAt,
    null,
  );
});
