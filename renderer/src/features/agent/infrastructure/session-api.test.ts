import { describe, expect, it, vi } from 'vite-plus/test';

import type { HttpClient } from '@/platform/http/client';

import { createAgentSessionApi } from './session-api';

function client(body: unknown = [], status = 200): HttpClient {
  return { request: vi.fn(async () => ({ body, status })) };
}

describe('Agent session API', () => {
  it('opens the shared socket without exposing renderer-owned window identity', () => {
    let opened = '';
    const socket = {
      readyState: 0,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      close: vi.fn(),
      send: vi.fn(),
    };
    const api = createAgentSessionApi(client(), 'https://127.0.0.1:43123/', (url) => {
      opened = url;
      return socket;
    });

    api.connect(
      {
        agent: 'codex',
        effort: 'high',
        model: 'gpt-codex',
        scope: { kind: 'folder', path: '/Notes & Plans' },
      },
      { onClose: vi.fn(), onEvent: vi.fn(), onInvalidResponse: vi.fn() },
    );

    const url = new URL(opened);
    expect(url.protocol).toBe('wss:');
    expect(url.pathname).toBe('/ws/agent');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      access: 'auto',
      agent: 'codex',
      effort: 'high',
      folder: '/Notes & Plans',
      model: 'gpt-codex',
    });
    expect(url.searchParams.has('windowId')).toBe(false);
  });

  it('validates history, replay, and websocket events at the adapter seam', async () => {
    const historyClient = client([
      {
        id: 'session-1',
        title: 'Research',
        lastModified: 42,
        hasContent: true,
        folder: '/Research',
      },
    ]);
    await expect(
      createAgentSessionApi(historyClient, 'http://127.0.0.1:1').list(
        'claude',
        { kind: 'folder', path: '/Research' },
        new AbortController().signal,
      ),
    ).resolves.toEqual([
      {
        agent: 'claude',
        hasContent: true,
        id: 'session-1',
        lastModified: 42,
        scope: { kind: 'folder', path: '/Research' },
        title: 'Research',
      },
    ]);
    expect(historyClient.request).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/api/agents/claude/sessions?folder=%2FResearch' }),
    );

    const malformed = createAgentSessionApi(
      client({ protocol: 1, messages: [], effort: null }),
      'http://127.0.0.1:1',
    );
    await expect(
      malformed.replay(
        {
          agent: 'codex',
          hasContent: true,
          id: 'session-1',
          lastModified: 42,
          scope: { kind: 'library' },
          title: 'Research',
        },
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ kind: 'invalid-response' });

    const invalid = vi.fn();
    const events: unknown[] = [];
    const messageListeners: Array<(event: { data: unknown }) => void> = [];
    const socket: {
      readyState: number;
      addEventListener(type: 'close', listener: () => void): void;
      addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
      removeEventListener(type: 'close', listener: () => void): void;
      removeEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
      close(): void;
      send(data: string): void;
    } = {
      readyState: 0,
      addEventListener(type, listener) {
        if (type === 'message') {
          messageListeners.push(listener as (event: { data: unknown }) => void);
        }
      },
      removeEventListener: () => undefined,
      close: () => undefined,
      send: () => undefined,
    };
    createAgentSessionApi(client(), 'http://127.0.0.1:1', () => socket).connect(
      { agent: 'stashbase', scope: { kind: 'library' } },
      { onClose: vi.fn(), onEvent: (event) => events.push(event), onInvalidResponse: invalid },
    );
    messageListeners[0]?.({ data: JSON.stringify({ t: 'unknown' }) });
    messageListeners[0]?.({ data: JSON.stringify({ t: 'session-id', id: 'native-1' }) });
    messageListeners[0]?.({
      data: JSON.stringify({
        t: 'models',
        models: [{ id: 'native-model', label: 'Native model', supportedEfforts: ['high'] }],
        activeModel: 'native-model',
      }),
    });
    expect(invalid).toHaveBeenCalledOnce();
    expect(events).toEqual([
      { id: 'native-1', kind: 'identified' },
      {
        activeModel: 'native-model',
        fallback: null,
        kind: 'models',
        models: [{ id: 'native-model', label: 'Native model', supportedEfforts: ['high'] }],
      },
    ]);
  });

  it('attributes folder-scoped history rows to the requested folder', async () => {
    const historyClient = client([
      { hasContent: true, id: 'session-1', title: 'Research', lastModified: 42 },
    ]);

    await expect(
      createAgentSessionApi(historyClient, 'http://127.0.0.1:1').list(
        'codex',
        { kind: 'folder', path: '/Library/Research' },
        new AbortController().signal,
      ),
    ).resolves.toEqual([
      {
        agent: 'codex',
        hasContent: true,
        id: 'session-1',
        lastModified: 42,
        scope: { kind: 'folder', path: '/Library/Research' },
        title: 'Research',
      },
    ]);
  });

  it('normalizes tool and permission events and validates permission replies', () => {
    const events: unknown[] = [];
    const sent: string[] = [];
    let onMessage: ((event: { data: unknown }) => void) | undefined;
    const socket: {
      readyState: number;
      addEventListener(type: 'close', listener: () => void): void;
      addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
      removeEventListener(type: 'close', listener: () => void): void;
      removeEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
      close(): void;
      send(data: string): void;
    } = {
      readyState: 1,
      addEventListener(type, listener) {
        if (type === 'message') onMessage = listener;
      },
      removeEventListener: vi.fn(),
      close: vi.fn(),
      send: (data: string) => {
        sent.push(data);
      },
    };
    const connection = createAgentSessionApi(client(), 'http://127.0.0.1:1', () => socket).connect(
      { access: 'default', agent: 'codex', scope: { kind: 'library' } },
      { onClose: vi.fn(), onEvent: (event) => events.push(event), onInvalidResponse: vi.fn() },
    );

    onMessage?.({
      data: JSON.stringify({ t: 'tool', id: 'tool-1', name: 'Bash', input: { command: 'pwd' } }),
    });
    onMessage?.({
      data: JSON.stringify({
        t: 'permission',
        id: 'permission-1',
        toolUseId: 'tool-1',
        name: 'Bash',
        title: null,
        input: { command: 'pwd' },
      }),
    });
    expect(connection.send?.({ t: 'permission-reply', id: 'permission-1', allow: true })).toBe(
      true,
    );

    expect(events).toEqual([
      { id: 'tool-1', input: { command: 'pwd' }, kind: 'tool-started', name: 'Bash' },
      {
        id: 'permission-1',
        input: { command: 'pwd' },
        kind: 'permission-requested',
        name: 'Bash',
        title: null,
        toolUseId: 'tool-1',
      },
    ]);
    expect(sent).toEqual([
      JSON.stringify({ t: 'permission-reply', id: 'permission-1', allow: true }),
    ]);
  });
});
