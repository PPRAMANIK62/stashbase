import { describe, expect, it, vi } from 'vite-plus/test';

import type { HttpClient } from '@/platform/http/client';

import { createAgentPersonaAdapter } from './agent-persona-api';

const STATE = {
  custom: '',
  scope: { kind: 'folder', path: '/project/Research' },
  selected: null,
};
const signal = () => new AbortController().signal;

function adapter(body: unknown = STATE) {
  const request = vi.fn(async () => ({ body, status: 200 }));
  return { adapter: createAgentPersonaAdapter({ request } as HttpClient), request };
}

describe('agent persona adapter', () => {
  it('reads a folder scope by its path, encoded', async () => {
    const { adapter: api, request } = adapter();
    await api.load({ kind: 'folder', path: '/project/my notes' }, signal());

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        path: '/api/agent-persona?scope=%2Fproject%2Fmy%20notes',
      }),
    );
  });

  // The route reads a scope string and re-derives the scope itself, which is
  // what keeps membership authority server-side.
  it('writes the scope as the spelling the route reads, not as the object', async () => {
    const { adapter: api, request } = adapter();
    await api.save(
      { kind: 'folder', path: '/project/notes' },
      { custom: 'Be terse.', selected: 'custom' },
      signal(),
    );

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { custom: 'Be terse.', scope: '/project/notes', selected: 'custom' },
        method: 'PUT',
      }),
    );
  });

  it('answers the chosen persona and the reader own prompt, never the resolved text', async () => {
    const { adapter: api } = adapter({
      custom: 'Mine.',
      scope: { kind: 'folder', path: '/project/Research' },
      selected: 'journalist',
    });

    expect(await api.load({ kind: 'folder', path: '/project/Research' }, signal())).toEqual({
      custom: 'Mine.',
      selected: 'journalist',
    });
  });

  it('refuses a response that names an unknown persona', async () => {
    const { adapter: api } = adapter({ ...STATE, selected: 'poet' });
    await expect(
      api.load({ kind: 'folder', path: '/project/Research' }, signal()),
    ).rejects.toMatchObject({ kind: 'invalid-response' });
  });
});
