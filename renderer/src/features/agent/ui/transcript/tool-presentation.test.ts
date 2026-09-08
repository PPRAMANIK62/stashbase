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
    expect(agentActivitySummary([tool(), tool({ id: 'tool-2' })], true)).toBe('Ran commands…');
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
