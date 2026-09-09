import { act, cleanup, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { createStore } from 'zustand/vanilla';

import type { DocumentTabsRuntime } from '@/features/documents/public';

import { AgentDocumentWorkspace } from './agent-document-workspace';

afterEach(cleanup);

function tabsRuntime() {
  const store = createStore<{ tabs: Array<{ id: string }> }>(() => ({ tabs: [] }));
  return { runtime: { store } as unknown as DocumentTabsRuntime, store };
}

describe('Agent document workspace row', () => {
  it('keeps one Agent workspace mounted while documents open and close', () => {
    const mounts = vi.fn();
    function AgentProbe() {
      useEffect(() => {
        mounts();
      }, []);
      return <div data-testid="agent" />;
    }
    const { runtime, store } = tabsRuntime();
    render(
      <AgentDocumentWorkspace
        agent={<AgentProbe />}
        document={<div data-testid="document">Plan</div>}
        onPaneWidthChange={vi.fn()}
        paneWidth={576}
        runtime={runtime}
      />,
    );

    expect(mounts).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('document-slot').getAttribute('aria-hidden')).toBe('true');
    expect(screen.queryByRole('separator', { name: 'Resize Agent pane' })).toBeNull();
    expect(screen.getByTestId('agent-pane').className).not.toContain('border-l');

    act(() => store.setState({ tabs: [{ id: 'tab-1' }] }));
    expect(mounts).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('document-slot').getAttribute('aria-hidden')).toBe('false');
    expect(screen.getByRole('separator', { name: 'Resize Agent pane' })).not.toBeNull();
    expect(screen.getByTestId('agent-pane').className).toContain('border-l');
    expect(screen.getByTestId('agent')).not.toBeNull();

    act(() => store.setState({ tabs: [] }));
    expect(mounts).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('document-slot').getAttribute('aria-hidden')).toBe('true');
    expect(screen.queryByRole('separator', { name: 'Resize Agent pane' })).toBeNull();
  });

  it('gives the Agent the whole row without a documents runtime', () => {
    render(
      <AgentDocumentWorkspace
        agent={<div data-testid="agent" />}
        document={null}
        onPaneWidthChange={vi.fn()}
        paneWidth={576}
        runtime={null}
      />,
    );
    expect(screen.getByTestId('agent')).not.toBeNull();
    expect(screen.getByTestId('agent-pane').getAttribute('style')).toBeNull();
  });
});
