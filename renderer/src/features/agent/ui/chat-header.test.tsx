import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  createAgentWorkspaceRuntime,
  type AgentWorkspaceRuntime,
} from '@/features/agent/application/workspace-runtime';
import { agentSessionPort } from '@/test/fakes/agent';

import { ChatHeader } from './chat-header';

const runtimes: AgentWorkspaceRuntime[] = [];

afterEach(() => {
  cleanup();
  for (const runtime of runtimes.splice(0)) runtime.dispose();
});

describe('ChatHeader', () => {
  it('draws the mark at the chrome stroke and keeps the actions at the row end', () => {
    const runtime = createAgentWorkspaceRuntime({
      autostart: false,
      createId: () => 'chat-1',
      folderPath: '/Library/Research',
      port: agentSessionPort().port,
    });
    runtimes.push(runtime);
    render(
      <ChatHeader
        failure={null}
        onRename={vi.fn()}
        session={runtime.newChat()}
        trailing={<button type="button">Act</button>}
      />,
    );

    const heading = screen.getByRole('heading', { name: /^Untitled, / });
    // The mark beside the name is drawn at the chrome's stroke, not the
    // heavier one it wears beside the vendor logos.
    const mark = heading.previousElementSibling; // dom-contract: the mark is the svg right before the name
    expect(mark?.getAttribute('stroke-width')).toBe('1.75');
    expect(screen.getByRole('button', { name: 'Act' })).not.toBeNull();
  });
});
