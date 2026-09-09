import { act, cleanup, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { createDocumentTabsRuntime } from '@/features/documents/public';
import { documentTabsRuntimeOptions } from '@/test/fakes/documents';

import { AgentDocumentWorkspace } from './agent-document-workspace';

afterEach(cleanup);

/** The row reads only whether any document is open, so the test opens and
 *  closes one real document rather than reaching into the runtime's store. */
const PLAN = { folderPath: '/library/notes', path: 'plan.md' } as const;

describe('Agent document workspace row', () => {
  it('keeps one Agent workspace mounted while documents open and close', async () => {
    const mounts = vi.fn();
    function AgentProbe() {
      useEffect(() => {
        mounts();
      }, []);
      return <div data-testid="agent" />;
    }
    const runtime = createDocumentTabsRuntime(documentTabsRuntimeOptions());
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

    await act(async () => void (await runtime.open(PLAN)));
    expect(mounts).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('document-slot').getAttribute('aria-hidden')).toBe('false');
    expect(screen.getByRole('separator', { name: 'Resize Agent pane' })).not.toBeNull();
    expect(screen.getByTestId('agent')).not.toBeNull();

    await act(async () => void (await runtime.closeSource(PLAN)));
    expect(mounts).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('document-slot').getAttribute('aria-hidden')).toBe('true');
    expect(screen.queryByRole('separator', { name: 'Resize Agent pane' })).toBeNull();
    runtime.dispose();
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
