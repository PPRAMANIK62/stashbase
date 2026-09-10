import { describe, expect, it, vi } from 'vite-plus/test';

import type { HttpClient } from '@/platform/http/client';

import { createRecoveryDraftAdapter } from './recovery-draft-api';

const source = { folderPath: '/library/research notes', path: 'drafts/plan #1.md' };
const wireSummary = {
  currentVersion: 'sha256:disk',
  expectedVersion: 'sha256:draft',
  folderPath: source.folderPath,
  path: source.path,
  savedAt: '2026-09-10T08:00:00.000Z',
};

function client(body: unknown, status = 200): HttpClient {
  return { request: vi.fn(async () => ({ body, status })) };
}

describe('recovery draft API', () => {
  it('lists the folder as candidates under the spelling the window asked with', async () => {
    const http = client({
      available: true,
      drafts: [{ ...wireSummary, folderPath: '/library/Research Notes' }],
    });
    const signal = new AbortController().signal;

    await expect(createRecoveryDraftAdapter(http).list(source.folderPath, signal)).resolves.toEqual(
      {
        available: true,
        drafts: [
          {
            currentVersion: 'sha256:disk',
            expectedVersion: 'sha256:draft',
            savedAt: '2026-09-10T08:00:00.000Z',
            source,
          },
        ],
      },
    );
    expect(http.request).toHaveBeenCalledWith({
      path: '/api/recovery-drafts?folder=%2Flibrary%2Fresearch+notes',
      signal,
    });
  });

  it('keeps an unavailable journal a named state', async () => {
    await expect(
      createRecoveryDraftAdapter(client({ available: false, reason: 'no-key' })).list(
        source.folderPath,
        new AbortController().signal,
      ),
    ).resolves.toEqual({ available: false, reason: 'no-key' });
  });

  it('reads one draft by source identity and refuses a mismatched answer', async () => {
    const http = client({ ...wireSummary, content: '# Draft' });
    const signal = new AbortController().signal;
    await expect(createRecoveryDraftAdapter(http).read(source, signal)).resolves.toEqual({
      content: '# Draft',
      currentVersion: 'sha256:disk',
      expectedVersion: 'sha256:draft',
      savedAt: '2026-09-10T08:00:00.000Z',
      source,
    });
    expect(http.request).toHaveBeenCalledWith({
      path: '/api/recovery-drafts/content?folder=%2Flibrary%2Fresearch+notes&path=drafts%2Fplan+%231.md',
      signal,
    });

    await expect(
      createRecoveryDraftAdapter(client({ ...wireSummary, content: 'x', path: 'other.md' })).read(
        source,
        signal,
      ),
    ).rejects.toMatchObject({ kind: 'invalid-response' });
  });

  it('writes a snapshot over PUT and discards over DELETE by identity', async () => {
    const written = client({ savedAt: '2026-09-10T08:00:00.000Z' });
    const signal = new AbortController().signal;
    await expect(
      createRecoveryDraftAdapter(written).write(
        { content: '# Draft', expectedVersion: 'sha256:draft', source },
        signal,
      ),
    ).resolves.toEqual({ savedAt: '2026-09-10T08:00:00.000Z' });
    expect(written.request).toHaveBeenCalledWith({
      body: {
        content: '# Draft',
        expectedVersion: 'sha256:draft',
        folderPath: source.folderPath,
        path: source.path,
      },
      method: 'PUT',
      path: '/api/recovery-drafts',
      signal,
    });

    const discarded = client({});
    await expect(createRecoveryDraftAdapter(discarded).discard(source, signal)).resolves.toBe(
      undefined,
    );
    expect(discarded.request).toHaveBeenCalledWith({
      method: 'DELETE',
      path: '/api/recovery-drafts?folder=%2Flibrary%2Fresearch+notes&path=drafts%2Fplan+%231.md',
      signal,
    });
  });

  it('classifies the journal refusals onto its own ladder', async () => {
    const signal = new AbortController().signal;
    const snapshot = { content: 'x', expectedVersion: 'v1', source };

    await expect(
      createRecoveryDraftAdapter(
        client({ code: 'RECOVERY_UNAVAILABLE', error: 'no key' }, 503),
      ).write(snapshot, signal),
    ).rejects.toMatchObject({
      kind: 'disabled',
      message: 'Draft recovery is unavailable on this installation.',
    });
    await expect(
      createRecoveryDraftAdapter(client({ code: 'DRAFT_TOO_LARGE', error: 'big' }, 413)).write(
        snapshot,
        signal,
      ),
    ).rejects.toMatchObject({ kind: 'too-large' });
    await expect(
      createRecoveryDraftAdapter(client({ code: 'NOT_FOUND', error: 'gone' }, 404)).read(
        source,
        signal,
      ),
    ).rejects.toMatchObject({ kind: 'not-found' });
    await expect(
      createRecoveryDraftAdapter(
        client({ code: 'FOLDER_UNAVAILABLE', error: 'not a member' }, 400),
      ).list(source.folderPath, signal),
    ).rejects.toMatchObject({ kind: 'scope-lost' });
    await expect(
      createRecoveryDraftAdapter(client({ error: 'boom' }, 500)).discard(source, signal),
    ).rejects.toMatchObject({ kind: 'unavailable' });
    await expect(
      createRecoveryDraftAdapter(client({ unexpected: true })).list(source.folderPath, signal),
    ).rejects.toMatchObject({ kind: 'invalid-response' });
  });

  it('refuses an oversized snapshot before it leaves the window', async () => {
    const http = client({ savedAt: '2026-09-10T08:00:00.000Z' });
    await expect(
      createRecoveryDraftAdapter(http).write(
        { content: 'x'.repeat(2 * 1024 * 1024 + 1), expectedVersion: 'v1', source },
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ kind: 'too-large' });
    expect(http.request).not.toHaveBeenCalled();
  });
});
