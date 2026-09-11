import { describe, expect, it } from 'vite-plus/test';

import { AGENT_RUNTIME_STAGES, type AgentRuntime } from '@/features/settings/domain/agent-catalog';
import { agentRuntime } from '@/test/fakes/settings';

import { agentRuntimeStageIndex, describeRuntime } from './agent-runtime-status';

/** A runtime nothing has run for yet: discovered, not installed, no ownership
 *  reported. Every case below names only the part it is about. */
function codex(overrides: Partial<AgentRuntime> = {}): AgentRuntime {
  return agentRuntime({
    id: 'codex',
    installed: false,
    label: 'Codex',
    ownership: null,
    preparation: { kind: 'idle' },
    ...overrides,
  });
}

describe('describeRuntime', () => {
  it('reports null stage while the catalog has not loaded this agent', () => {
    expect(describeRuntime(undefined, false)).toEqual({
      description: 'Checking…',
      failed: false,
      stage: null,
      action: null,
    });
  });

  it('offers Install for a not-yet-installed idle runtime, and withholds it while busy', () => {
    expect(describeRuntime(codex({ installed: false }), false)).toEqual({
      description: 'Not installed',
      failed: false,
      stage: 'discover',
      action: { kind: 'install', label: 'Install' },
    });
    expect(describeRuntime(codex({ installed: false }), true)).toEqual({
      description: 'Not installed',
      failed: false,
      stage: 'discover',
      action: null,
    });
  });

  it.each([
    ['install', 1],
    ['authenticate', 2],
    ['configure', 3],
  ] as const)(
    'reads a running %s preparation at track position %d with no action',
    (stage, position) => {
      const display = describeRuntime(
        codex({
          installed: true,
          preparation: { kind: 'running', note: 'Setting things up…', stage },
        }),
        false,
      );
      expect(display).toEqual({
        description: 'Setting things up…',
        failed: false,
        stage,
        action: null,
      });
      expect(agentRuntimeStageIndex(stage)).toBe(position);
    },
  );

  it('routes an account-required failure to sign-in regardless of failure stage', () => {
    const display = describeRuntime(
      codex({
        installed: true,
        preparation: {
          kind: 'failed',
          failure: {
            note: 'An account is required to use OpenQuill.',
            refusal: 'account-required',
            stage: 'install',
          },
        },
      }),
      false,
    );
    expect(display).toEqual({
      description: 'An account is required to use OpenQuill.',
      failed: true,
      stage: 'install',
      action: { kind: 'account', label: 'Sign in' },
    });
  });

  it('offers sign-in for an authenticate-stage failure without an account-required refusal', () => {
    const display = describeRuntime(
      codex({
        installed: true,
        preparation: {
          kind: 'failed',
          failure: {
            note: 'Codex needs you to sign in.',
            refusal: 'authentication-required',
            stage: 'authenticate',
          },
        },
      }),
      false,
    );
    expect(display.action).toEqual({ kind: 'login', label: 'Sign in' });
    expect(display.stage).toBe('authenticate');
  });

  it('labels a configure-stage failure as a connection retry', () => {
    const display = describeRuntime(
      codex({
        installed: true,
        preparation: {
          kind: 'failed',
          failure: { note: 'MCP failed.', refusal: 'operation-failed', stage: 'configure' },
        },
      }),
      false,
    );
    expect(display.action).toEqual({ kind: 'retry', label: 'Retry connection' });
    expect(display.stage).toBe('configure');
  });

  it('labels an install-stage failure as a plain retry', () => {
    const display = describeRuntime(
      codex({
        installed: false,
        preparation: {
          kind: 'failed',
          failure: { note: 'Install failed.', refusal: 'operation-failed', stage: 'install' },
        },
      }),
      false,
    );
    expect(display.action).toEqual({ kind: 'retry', label: 'Retry' });
    expect(display.stage).toBe('install');
  });

  it('withholds the failure action while a retry is already in flight', () => {
    const display = describeRuntime(
      codex({
        installed: true,
        preparation: {
          kind: 'failed',
          failure: { note: 'MCP failed.', refusal: 'operation-failed', stage: 'configure' },
        },
      }),
      true,
    );
    expect(display.action).toBeNull();
    expect(display.failed).toBe(true);
  });

  it('treats an installed runtime with an idle preparation as already ready, without the "Ready for Chat" prefix', () => {
    const display = describeRuntime(
      codex({ installed: true, ownership: 'system', preparation: { kind: 'idle' } }),
      false,
    );
    expect(display).toEqual({
      description: 'System runtime',
      failed: false,
      stage: 'ready',
      action: null,
    });
  });

  it.each([
    ['bundled', 'Included with StashBase'],
    ['managed', 'StashBase-managed runtime'],
    ['system', 'System runtime'],
  ] as const)(
    'describes a ready %s runtime with the "Ready for Chat" prefix and matching ownership text',
    (ownership, label) => {
      const display = describeRuntime(
        codex({ installed: true, ownership, preparation: { kind: 'ready' } }),
        false,
      );
      expect(display).toEqual({
        description: `Ready for Chat · ${label}`,
        failed: false,
        stage: 'ready',
        action: null,
      });
    },
  );

  it('derives every stage position from the declared track order', () => {
    expect(AGENT_RUNTIME_STAGES.map(agentRuntimeStageIndex)).toEqual([0, 1, 2, 3, 4]);
  });
});
