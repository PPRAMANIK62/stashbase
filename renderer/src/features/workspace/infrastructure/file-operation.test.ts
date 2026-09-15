import { expect, it, vi } from 'vite-plus/test';

import type { HttpClient } from '@/platform/http/client';

import { createFilesAdapter } from './files-api';

it('confirms a lost rename response without repeating the mutation', async () => {
  const request = vi
    .fn<HttpClient['request']>()
    .mockRejectedValueOnce(new Error('connection lost'))
    .mockResolvedValueOnce({ status: 202, body: { pending: true } })
    .mockResolvedValueOnce({ status: 200, body: { status: 200, body: { name: 'new.md' } } });
  const api = createFilesAdapter({ request });
  const rename = () =>
    api.renameEntry(
      '/project',
      { kind: 'file', path: 'old.md' },
      'new.md',
      new AbortController().signal,
    );
  await expect(rename()).rejects.toMatchObject({ kind: 'outcome-unknown' });
  await expect(rename()).resolves.toEqual({ path: 'new.md' });
  expect(request.mock.calls.filter(([call]) => call.method === 'PATCH')).toHaveLength(1);
  const original = new URL(request.mock.calls[0]?.[0].path ?? '', 'http://localhost');
  const id = original.searchParams.get('operationId');
  expect(request.mock.calls[1]?.[0].path).toContain(`/api/file-operations/${id}?`);
  expect(request.mock.calls[2]?.[0].path).toBe(request.mock.calls[1]?.[0].path);
});

it('does not replay an unknown delete or accept changed input on an uncertain rename', async () => {
  const request = vi.fn<HttpClient['request']>().mockRejectedValue(new Error('offline'));
  const api = createFilesAdapter({ request });
  const entry = { kind: 'file', path: 'old.md' } as const;
  const signal = new AbortController().signal;
  await expect(api.renameEntry('/project', entry, 'new.md', signal)).rejects.toMatchObject({
    kind: 'outcome-unknown',
  });
  await expect(api.renameEntry('/project', entry, 'different.md', signal)).rejects.toMatchObject({
    kind: 'outcome-unknown',
  });
  await expect(api.deleteEntry('/project', entry, signal)).rejects.toMatchObject({
    kind: 'outcome-unknown',
  });
  expect(request.mock.calls.filter(([call]) => call.method)).toHaveLength(1);
});
