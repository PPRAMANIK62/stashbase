import { describe, expect, it } from 'vite-plus/test';

import {
  agentActivitySummary,
  agentPermissionTitle,
  agentToolPayload,
  agentToolResult,
  agentToolRow,
  type AgentToolBlock,
} from './tool-presentation';

const tool = (overrides: Partial<AgentToolBlock> = {}): AgentToolBlock => ({
  id: 'tool-1',
  input: { command: 'pnpm test:agent' },
  kind: 'tool',
  name: 'Bash',
  status: 'running',
  ...overrides,
});

describe('Agent tool presentation', () => {
  it('uses human verbs and count-free activity summaries', () => {
    expect(agentToolRow(tool())).toEqual({
      mono: true,
      target: 'pnpm test:agent',
      verb: 'Ran',
    });
    expect(
      agentActivitySummary(
        [tool({ status: 'done' }), tool({ id: 'tool-2', status: 'done' })],
        false,
      ),
    ).toBe('Ran commands');
  });

  it('names the step in hand while the work moves, and clips a long one once', () => {
    // The turn is what makes a group live, so the header still names the last
    // step between two calls, when nothing is running.
    expect(
      agentActivitySummary(
        [tool({ status: 'done' }), tool({ id: 'tool-2', status: 'done' })],
        true,
      ),
    ).toBe('Ran pnpm test:agent…');
    // Parallel calls: the one still running is the step in hand, even when a
    // later call has already settled.
    expect(
      agentActivitySummary(
        [
          tool(),
          {
            ...tool({ id: 'read-1', status: 'done' }),
            input: { path: '/project/plan.md' },
            name: 'stashbase_read_file',
          },
        ],
        true,
      ),
    ).toBe('Ran pnpm test:agent…');
    const long = agentActivitySummary(
      [tool({ input: { command: `pnpm exec vitest run ${'x'.repeat(80)}` } })],
      true,
    );
    expect(long.endsWith('…')).toBe(true);
    expect(long.endsWith('……')).toBe(false);
    expect(long.length).toBeLessThan(60);
  });

  it('unwraps MCP arguments and bounds payloads and results', () => {
    expect(agentToolPayload({ arguments: { path: 'notes.md', empty: '' }, server: '' })).toBe(
      'path: notes.md',
    );
    expect(agentToolPayload({ text: 'x'.repeat(2_000) })).toContain('characters)');
    expect(agentToolResult('x'.repeat(4_100))).toContain('result truncated');
  });

  it('names explicit command and write decisions', () => {
    expect(agentPermissionTitle(tool())).toBe('Run this command?');
    expect(
      agentPermissionTitle(tool({ name: 'stashbase_write_file', permissionTitle: null })),
    ).toBe('Apply these changes?');
  });
});
