import { describe, expect, it, vi } from 'vite-plus/test';

import type { HttpClient } from '@/platform/http/client';

import { createDocumentRevisionsAdapter } from './revision-api';

const folderPath = '/project/notes';

function hostWith(proposals: unknown[]): HttpClient {
  return {
    request: vi.fn(async () => ({ body: { folder: folderPath, proposals }, status: 200 })),
  };
}

function wireProposal(overrides: Record<string, unknown> = {}) {
  return {
    id: 'proposal-1',
    baseVersion: 'sha256:v1',
    content: '# Revised plan\n',
    createdAt: 1_700_000_000_000,
    origin: 'agent',
    path: `${folderPath}/plans/q3 plan.md`,
    ...overrides,
  };
}

describe('document revisions API', () => {
  it('drains a folder and reads an absolute path as a source inside it', async () => {
    const client = hostWith([wireProposal()]);
    const signal = new AbortController().signal;

    await expect(createDocumentRevisionsAdapter(client).drain(folderPath, signal)).resolves.toEqual(
      {
        proposals: [
          {
            id: 'proposal-1',
            baseVersion: 'sha256:v1',
            content: '# Revised plan\n',
            createdAt: 1_700_000_000_000,
            origin: { kind: 'agent' },
            source: { folderPath, path: 'plans/q3 plan.md' },
          },
        ],
        unresolved: [],
      },
    );
    expect(client.request).toHaveBeenCalledWith({
      path: '/api/document-revisions?folder=%2Fproject%2Fnotes',
      signal,
    });
  });

  it('names a proposal whose path escapes the folder instead of opening it', async () => {
    const client = hostWith([
      wireProposal({ path: '/project/other/secret.md' }),
      wireProposal({ path: `${folderPath}/../escape.md` }),
      wireProposal({ path: folderPath }),
      wireProposal({ path: 'plans/relative.md' }),
    ]);

    // The drain consumed all four, so none of them may vanish here: a
    // proposal this window cannot open is still one the agent said it parked.
    await expect(
      createDocumentRevisionsAdapter(client).drain(folderPath, new AbortController().signal),
    ).resolves.toEqual({
      proposals: [],
      unresolved: ['secret.md', 'escape.md', 'notes', 'relative.md'],
    });
  });

  it('reports a lost folder grant on the documents ladder', async () => {
    const api = createDocumentRevisionsAdapter({
      request: vi.fn(async () => ({ body: { error: '/project/notes is gone' }, status: 410 })),
    });

    await expect(api.drain(folderPath, new AbortController().signal)).rejects.toMatchObject({
      kind: 'scope-lost',
      message: 'That folder is no longer available in this window.',
    });
  });

  it('refuses a body it cannot read rather than inventing a proposal', async () => {
    const api = createDocumentRevisionsAdapter({
      request: vi.fn(async () => ({ body: { proposals: [{ path: 42 }] }, status: 200 })),
    });

    await expect(api.drain(folderPath, new AbortController().signal)).rejects.toMatchObject({
      kind: 'invalid-response',
    });
  });
});
