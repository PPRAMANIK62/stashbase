import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  createAgentSessionRuntime,
  type AgentSessionRuntime,
} from '@/features/agent/application/session-runtime';
import type { AgentScopeEnvironment } from '@/features/agent/domain/context';
import { typeInto } from '@/test/dom';
import { agentContextPort, agentSessionPort, type FakeAgentSession } from '@/test/fakes/agent';

import { AgentContextComposer } from './context-composer';

const SCOPE = { kind: 'folder', path: '/library/Research' } as const;

const environment: AgentScopeEnvironment = {
  folderPath: SCOPE.path,
  listing: {
    files: [
      { format: 'md', path: 'notes.md' },
      { format: 'image', path: 'chart.png' },
    ],
    folders: ['drafts'],
  },
  readiness: {},
  versions: {},
};

const runtimes: AgentSessionRuntime[] = [];

afterEach(() => {
  cleanup();
  for (const runtime of runtimes.splice(0)) runtime.dispose();
});

function renderComposer(overrides: { skills?: boolean } = {}) {
  const port: FakeAgentSession = agentSessionPort();
  const session = createAgentSessionRuntime({
    agent: 'codex',
    context: agentContextPort(),
    environment: () => ({ listing: environment.listing, readiness: environment.readiness }),
    id: 'chat-1',
    port: port.port,
    scope: SCOPE,
  });
  runtimes.push(session);
  const spies = {
    onQueueChange: vi.fn(),
    onRefreshSkills: vi.fn(),
    onSkillChange: vi.fn(),
    onStop: vi.fn(),
  };
  const view = render(
    <AgentContextComposer
      attachments
      environment={environment}
      queue={[]}
      placeholder="Ask about Research…"
      session={session}
      skills={overrides.skills ?? true}
      status="idle"
      {...spies}
    />,
  );
  const field = screen.getByRole('textbox', { name: 'Message' });
  return { field, port, session, view, ...spies };
}

/** Puts the runtime in the live state a skill catalog arrives in. */
function announceSkills(
  port: FakeAgentSession,
  skills: Array<{ id: string; label: string; description?: string }>,
  state: 'available' | 'empty' | 'failed' = 'available',
) {
  act(() => {
    port.listeners[0]?.onEvent({ kind: 'ready' });
    port.listeners[0]?.onEvent({ error: null, kind: 'skills', skills, state });
  });
}

describe('Agent context composer', () => {
  it('suggests scope files for an @ query and binds the picked one to the draft', async () => {
    const { field, session } = renderComposer();

    typeInto(field, 'Read @not');
    const option = await screen.findByRole('option', { name: /notes\.md/u });
    await userEvent.click(option);

    expect(session.store.getState().draft).toBe('Read @notes.md ');
    expect(session.store.getState().context).toEqual([
      expect.objectContaining({
        kind: 'source',
        source: { folderPath: SCOPE.path, path: 'notes.md' },
      }),
    ]);
  });

  it('closes the suggestion list when the query no longer matches anything', async () => {
    const { field } = renderComposer();

    typeInto(field, 'Read @not');
    expect(await screen.findByRole('listbox', { name: 'Mention a file or folder' })).not.toBeNull();

    typeInto(field, 'hingatall');
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
  });

  it('keeps the / panel open with no rows and says why the folder has none', async () => {
    const { field, port } = renderComposer();
    announceSkills(port, []);

    typeInto(field, '/');
    expect(await screen.findByText('No skills are available for this folder.')).not.toBeNull();
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('offers a retry when the runtime could not read its skills', async () => {
    const { field, onRefreshSkills, port } = renderComposer();
    announceSkills(port, [], 'failed');

    typeInto(field, '/');
    await userEvent.click(await screen.findByRole('button', { name: 'Retry' }));
    expect(onRefreshSkills).toHaveBeenCalledOnce();
  });

  it('arms the picked skill and reports it to the owner', async () => {
    const { field, onSkillChange, port } = renderComposer();
    announceSkills(port, [{ description: 'Review a draft', id: 'review', label: 'review' }]);

    typeInto(field, '/rev');
    await userEvent.click(await screen.findByRole('option', { name: /review/u }));
    expect(onSkillChange).toHaveBeenCalledWith('review');
  });

  it('ignores / entirely when the runtime cannot run skills', async () => {
    const { field, port } = renderComposer({ skills: false });
    announceSkills(port, [{ id: 'review', label: 'review' }]);

    typeInto(field, '/rev');
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
    expect(screen.queryByText('No matching skills.')).toBeNull();
  });

  it('gives a bound visual source a preview tile and unbinds it when removed', async () => {
    const { session } = renderComposer();
    act(() => {
      session.addContext({
        boundVersion: null,
        format: 'image',
        kind: 'source',
        source: { folderPath: SCOPE.path, path: 'chart.png' },
      });
    });

    const tiles = await screen.findByRole('list', { name: 'Attached context' });
    expect(tiles).not.toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Remove chart.png' }));
    expect(session.store.getState().context).toEqual([]);
  });

  it('shows the refusal the session recorded for the last send', async () => {
    const { port, session } = renderComposer();
    act(() => {
      port.listeners[0]?.onEvent({ kind: 'ready' });
      session.addContext({
        boundVersion: null,
        format: 'md',
        kind: 'source',
        source: { folderPath: '/library/Plans', path: 'gone.md' },
      });
    });
    await act(async () => {
      await session.sendPrompt('Summarize this');
    });

    expect((await screen.findByRole('alert')).textContent).toBe(
      'This file belongs to a different folder.',
    );
  });
});
