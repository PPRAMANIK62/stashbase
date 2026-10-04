import { describe, expect, it, vi } from 'vite-plus/test';

import type { HttpClient } from '@/platform/http/client';

import { createDocumentTurnChangesAdapter } from './turn-change-api';

const folderPath = '/project/notes';
const source = { folderPath, path: 'plans/q3 plan.md' };

function hostAnswering(status: number, body: unknown): HttpClient {
  return { request: vi.fn(async () => ({ body, status })) };
}

describe('turn changes API', () => {
  it('asks for the absolute path inside the folder and keeps the requested source', async () => {
    const client = hostAnswering(200, {
      afterVersion: 'sha256:after',
      before: '# Before\n',
      change: 'edited',
      folder: folderPath,
      path: `${folderPath}/plans/q3 plan.md`,
      turnId: 'turn-1',
    });
    const signal = new AbortController().signal;

    await expect(
      createDocumentTurnChangesAdapter(client).load({ source, turnId: 'turn-1' }, signal),
    ).resolves.toEqual({
      afterVersion: 'sha256:after',
      before: '# Before\n',
      source,
      turnId: 'turn-1',
    });
    const query = new URLSearchParams({
      folder: folderPath,
      turn: 'turn-1',
      path: `${folderPath}/plans/q3 plan.md`,
    });
    expect(client.request).toHaveBeenCalledWith({ path: `/api/turn-changes?${query}`, signal });
  });

  it('reads only the host expiry code as an expired turn, not any 404', async () => {
    const signal = new AbortController().signal;
    const expired = createDocumentTurnChangesAdapter(
      hostAnswering(404, { code: 'TURN_CHANGE_EXPIRED', error: 'gone' }),
    );
    const folderGone = createDocumentTurnChangesAdapter(
      hostAnswering(404, { code: 'FOLDER_NOT_FOUND', error: 'folder not found' }),
    );

    await expect(expired.load({ source, turnId: 'turn-1' }, signal)).rejects.toMatchObject({
      kind: 'expired',
    });
    await expect(folderGone.load({ source, turnId: 'turn-1' }, signal)).rejects.toMatchObject({
      kind: 'scope-lost',
    });
  });
});
