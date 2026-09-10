import { describe, expect, it, vi } from 'vite-plus/test';

import type { HttpClient } from '@/platform/http/client';

import { createAgentInstructionsAdapter } from './agent-instructions-api';

const STATE = { customized: false, scope: { kind: 'library' }, text: 'Packaged.' };
const signal = () => new AbortController().signal;

function adapter(body: unknown = STATE) {
  const request = vi.fn(async () => ({ body, status: 200 }));
  return { adapter: createAgentInstructionsAdapter({ request } as HttpClient), request };
}

describe('agent instructions adapter', () => {
  it('reads the Library scope by its one wire spelling', async () => {
    const { adapter: api, request } = adapter();
    await api.load({ kind: 'library' }, signal());

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'GET', path: '/api/agent-instructions?scope=library' }),
    );
  });

  it('reads a folder scope by its path, encoded', async () => {
    const { adapter: api, request } = adapter();
    await api.load({ kind: 'folder', path: '/library/my notes' }, signal());

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/api/agent-instructions?scope=%2Flibrary%2Fmy%20notes',
      }),
    );
  });

  // The route reads a scope string and re-derives the scope itself, which is
  // what keeps membership authority server-side.
  it('writes the scope as the spelling the route reads, not as the object', async () => {
    const { adapter: api, request } = adapter();
    await api.save({ kind: 'folder', path: '/library/notes' }, 'Be terse.', signal());

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { scope: '/library/notes', text: 'Be terse.' },
        method: 'PUT',
      }),
    );
  });

  it('answers whether the text is the reader own, never the resolved prompt', async () => {
    const { adapter: api } = adapter({
      customized: true,
      scope: { kind: 'library' },
      text: 'Mine.',
    });

    expect(await api.load({ kind: 'library' }, signal())).toEqual({
      customized: true,
      text: 'Mine.',
    });
  });

  it('refuses a response whose scope names neither kind', async () => {
    const { adapter: api } = adapter({ customized: false, scope: { kind: 'window' }, text: '' });
    await expect(api.load({ kind: 'library' }, signal())).rejects.toMatchObject({
      kind: 'invalid-response',
    });
  });
});
