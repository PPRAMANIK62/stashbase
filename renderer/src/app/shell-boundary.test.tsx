import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { ShellBoundary } from './shell-boundary';

afterEach(cleanup);

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Whether the fixture window is still broken. A test clears it before
 *  reopening, standing in for composition that renders on the second attempt. */
let failing = true;

beforeEach(() => {
  failing = true;
});

function Window() {
  if (failing) throw new Error('a binder threw');
  return <p>Workspace</p>;
}

describe('ShellBoundary', () => {
  it('offers the reader the workspace recovery and says what unsaved text does', () => {
    render(
      <ShellBoundary>
        <Window />
      </ShellBoundary>,
    );

    expect(screen.getByText('The workspace could not be drawn.').isConnected).toBe(true);
    expect(
      screen.getByText(
        'Reopening reloads this folder from disk. Unsaved text comes back from draft recovery where StashBase could store it, and never includes the last few seconds of typing.',
      ).isConnected,
    ).toBe(true);
  });

  it('remounts the window when the reader reopens it', () => {
    render(
      <ShellBoundary>
        <Window />
      </ShellBoundary>,
    );

    failing = false;
    fireEvent.click(screen.getByRole('button', { name: 'Reopen the workspace' }));

    expect(screen.getByText('Workspace').isConnected).toBe(true);
    expect(screen.queryByText('The workspace could not be drawn.')).toBeNull();
  });

  it('leaves what the shell mounts outside it alone', () => {
    render(
      <>
        <p>Titlebar</p>
        <ShellBoundary>
          <Window />
        </ShellBoundary>
      </>,
    );

    expect(screen.getByText('The workspace could not be drawn.').isConnected).toBe(true);
    expect(screen.getByText('Titlebar').isConnected).toBe(true);
  });
});
