import { describe, expect, it } from 'vite-plus/test';

import type { Agent } from '@/shared/agent-runtime';

import { describeRuntime } from './agent-runtime-status';

function agent(overrides: Partial<Agent>): Agent {
  return {
    id: 'codex',
    label: 'Codex',
    vendor: 'OpenAI',
    installHint: 'npm install -g codex',
    installed: false,
    launchCommand: 'codex',
    ...overrides,
  };
}

describe('describeRuntime', () => {
  it('reports null stage while the catalog has not loaded this agent', () => {
    expect(describeRuntime(undefined, false)).toEqual({
      description: 'Checking…',
      failed: false,
      stage: null,
      stageIndex: 0,
      action: null,
    });
  });

  it('offers Install for a not-yet-installed idle runtime, and withholds it while busy', () => {
    expect(describeRuntime(agent({ installed: false }), false)).toEqual({
      description: 'Not installed',
      failed: false,
      stage: 'discover',
      stageIndex: 0,
      action: { kind: 'install', label: 'Install' },
    });
    expect(describeRuntime(agent({ installed: false }), true)).toEqual({
      description: 'Not installed',
      failed: false,
      stage: 'discover',
      stageIndex: 0,
      action: null,
    });
  });

  it.each([
    ['installing', 'install', 1],
    ['authenticating', 'authenticate', 2],
    ['configuring', 'configure', 3],
  ] as const)(
    'maps bootstrap phase %s onto stage %s at index %d with no action',
    (phase, stage, stageIndex) => {
      const display = describeRuntime(
        agent({ installed: true, bootstrap: { phase, message: 'Setting things up…' } }),
        false,
      );
      expect(display).toEqual({
        description: 'Setting things up…',
        failed: false,
        stage,
        stageIndex,
        action: null,
      });
    },
  );

  it('routes an account-required failure to sign-in regardless of failure stage', () => {
    const display = describeRuntime(
      agent({
        installed: true,
        bootstrap: {
          phase: 'failed',
          failure: {
            stage: 'installation',
            code: 'account-required',
            message: 'An account is required to use Built-in.',
            retryable: true,
          },
        },
      }),
      false,
    );
    expect(display).toEqual({
      description: 'An account is required to use Built-in.',
      failed: true,
      stage: 'install',
      stageIndex: 1,
      action: { kind: 'account', label: 'Sign in' },
    });
  });

  it('offers sign-in for an authentication-stage failure without an account-required code', () => {
    const display = describeRuntime(
      agent({
        installed: true,
        bootstrap: {
          phase: 'failed',
          failure: {
            stage: 'authentication',
            code: 'authentication-required',
            message: 'Codex needs you to sign in.',
            retryable: true,
          },
        },
      }),
      false,
    );
    expect(display.action).toEqual({ kind: 'login', label: 'Sign in' });
    expect(display.stage).toBe('authenticate');
    expect(display.stageIndex).toBe(2);
  });

  it('labels an mcp-stage failure as a connection retry', () => {
    const display = describeRuntime(
      agent({
        installed: true,
        bootstrap: {
          phase: 'failed',
          failure: {
            stage: 'mcp',
            code: 'operation-failed',
            message: 'MCP failed.',
            retryable: true,
          },
        },
      }),
      false,
    );
    expect(display.action).toEqual({ kind: 'retry', label: 'Retry connection' });
    expect(display.stage).toBe('configure');
    expect(display.stageIndex).toBe(3);
  });

  it('labels an installation-stage failure as a plain retry', () => {
    const display = describeRuntime(
      agent({
        installed: false,
        bootstrap: {
          phase: 'failed',
          failure: {
            stage: 'installation',
            code: 'operation-failed',
            message: 'Install failed.',
            retryable: true,
          },
        },
      }),
      false,
    );
    expect(display.action).toEqual({ kind: 'retry', label: 'Retry' });
    expect(display.stage).toBe('install');
    expect(display.stageIndex).toBe(1);
  });

  it('withholds the failure action while a retry is already in flight', () => {
    const display = describeRuntime(
      agent({
        installed: true,
        bootstrap: {
          phase: 'failed',
          failure: {
            stage: 'mcp',
            code: 'operation-failed',
            message: 'MCP failed.',
            retryable: true,
          },
        },
      }),
      true,
    );
    expect(display.action).toBeNull();
    expect(display.failed).toBe(true);
  });

  it('treats an installed runtime with no bootstrap report as already ready, without the "Ready for Chat" prefix', () => {
    const display = describeRuntime(agent({ installed: true, source: 'system' }), false);
    expect(display).toEqual({
      description: 'System runtime',
      failed: false,
      stage: 'ready',
      stageIndex: 4,
      action: null,
    });
  });

  it.each([
    ['bundled', 'Included with StashBase'],
    ['managed', 'StashBase-managed runtime'],
    ['system', 'System runtime'],
  ] as const)(
    'describes a ready %s runtime with the "Ready for Chat" prefix and matching source text',
    (source, label) => {
      const display = describeRuntime(
        agent({ installed: true, source, bootstrap: { phase: 'ready' } }),
        false,
      );
      expect(display).toEqual({
        description: `Ready for Chat · ${label}`,
        failed: false,
        stage: 'ready',
        stageIndex: 4,
        action: null,
      });
    },
  );
});
