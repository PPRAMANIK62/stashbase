import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Component, type ComponentType, type ErrorInfo, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { lazySurface } from './lazy-surface';

afterEach(cleanup);

interface PanelProps {
  open: boolean;
  title: string;
}

function Panel({ title }: PanelProps) {
  return <p>{title}</p>;
}

/** A loader that resolves only when the test says so, so the fallback is
 *  observable instead of racing the import. */
function heldLoader(component: ComponentType<PanelProps> = Panel) {
  const pending: (() => void)[] = [];
  const load = vi.fn(
    () =>
      new Promise<{ default: ComponentType<PanelProps> }>((resolve) => {
        pending.push(() => resolve({ default: component }));
      }),
  );
  return {
    load,
    release: () => {
      for (const settle of pending.splice(0)) settle();
    },
  };
}

interface BoundaryProps {
  children: ReactNode;
  onRetry(): void;
}

/** Stands in for a feature's own error boundary, minus its chrome. */
class TestBoundary extends Component<BoundaryProps, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(_error: Error, _info: ErrorInfo) {
    // The failure is the assertion; swallowing keeps the run quiet.
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <button
        onClick={() => {
          this.props.onRetry();
          this.setState({ failed: false });
        }}
        type="button"
      >
        Retry
      </button>
    );
  }
}

describe('lazySurface', () => {
  it('never imports the chunk while the gate is closed', () => {
    const { load } = heldLoader();
    const Surface = lazySurface(load, { when: (props: PanelProps) => props.open });

    render(<Surface open={false} title="Quick open" />);

    expect(load).not.toHaveBeenCalled();
    expect(screen.queryByText('Quick open')).toBeNull();
  });

  it('shows the fallback until the chunk lands, then the surface', async () => {
    const { load, release } = heldLoader();
    const Surface = lazySurface(load, {
      fallback: <p>Loading…</p>,
      when: (props: PanelProps) => props.open,
    });

    render(<Surface open title="Quick open" />);
    expect((await screen.findByText('Loading…')).isConnected).toBe(true);

    release();
    expect((await screen.findByText('Quick open')).isConnected).toBe(true);
  });

  it('renders straight through when no gate is given', async () => {
    const { load, release } = heldLoader();
    const Surface = lazySurface(load);

    render(<Surface open title="Agent" />);
    release();

    expect((await screen.findByText('Agent')).isConnected).toBe(true);
  });

  it('hands the boundary a retry that reloads a chunk that failed', async () => {
    let attempt = 0;
    const load = vi.fn(() => {
      attempt += 1;
      return attempt === 1
        ? Promise.reject(new Error('chunk unavailable'))
        : Promise.resolve({ default: Panel });
    });
    const Surface = lazySurface(load, {
      boundary: (retry, children) => <TestBoundary onRetry={retry}>{children}</TestBoundary>,
    });

    render(<Surface open title="Agent" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));

    expect((await screen.findByText('Agent')).isConnected).toBe(true);
    expect(load).toHaveBeenCalledTimes(2);
  });
});
