import { describe, expect, it, vi } from 'vite-plus/test';

import { DocumentHumanizeError } from '@/features/documents/application/ports';
import type { HttpClient } from '@/platform/http/client';

import { createDocumentHumanizeAdapter } from './humanize-api';

function hostAnswering(status: number, body: unknown): HttpClient {
  return { request: vi.fn(async () => ({ body, status })) };
}

describe('document humanize API', () => {
  it('posts the selection and reads the whole rewrite back', async () => {
    const client = hostAnswering(200, { text: 'A plain line.' });
    const signal = new AbortController().signal;

    await expect(
      createDocumentHumanizeAdapter(client).humanize({ text: 'A line, comprehensively.' }, signal),
    ).resolves.toEqual({ text: 'A plain line.' });
    expect(client.request).toHaveBeenCalledWith({
      body: { text: 'A line, comprehensively.' },
      method: 'POST',
      path: '/api/humanize',
      signal,
    });
  });

  it.each([
    [429, 'busy'],
    [413, 'too-long'],
    [422, 'cut-off'],
  ] as const)('reads a %i as the %s kind only this capability meets', async (status, kind) => {
    const client = hostAnswering(status, { error: 'refused', code: 'HUMANIZE_X' });
    const signal = new AbortController().signal;

    const failure = await createDocumentHumanizeAdapter(client)
      .humanize({ text: 'A line.' }, signal)
      .then(
        () => null,
        (error: unknown) => error,
      );
    expect(failure).toBeInstanceOf(DocumentHumanizeError);
    expect((failure as DocumentHumanizeError).kind).toBe(kind);
  });

  it('reads a service outage on the shared ladder and an unreadable rewrite as invalid', async () => {
    const signal = new AbortController().signal;
    const outage = await createDocumentHumanizeAdapter(hostAnswering(503, { error: 'down' }))
      .humanize({ text: 'A line.' }, signal)
      .then(
        () => null,
        (error: unknown) => error,
      );
    expect((outage as DocumentHumanizeError).kind).toBe('unavailable');

    const unreadable = await createDocumentHumanizeAdapter(hostAnswering(200, { text: '' }))
      .humanize({ text: 'A line.' }, signal)
      .then(
        () => null,
        (error: unknown) => error,
      );
    expect((unreadable as DocumentHumanizeError).kind).toBe('invalid-response');
  });
});
