import { expect, it, vi } from 'vite-plus/test';

import { createLocalComponentAdapter } from './local-component-api';

it('maps component status and keeps Retry on its explicit bodyless-options route', async () => {
  const request = vi.fn(async () => ({
    body: { status: 'failed', error: 'network' },
    status: 200,
  }));
  const port = createLocalComponentAdapter({ request });
  const signal = new AbortController().signal;
  await expect(port.load(signal)).resolves.toEqual({ status: 'failed', error: 'network' });
  expect(request).toHaveBeenLastCalledWith(
    expect.objectContaining({ path: '/api/local-components/extractor', signal }),
  );
  await port.retry(signal);
  expect(request).toHaveBeenLastCalledWith(
    expect.objectContaining({
      method: 'POST',
      path: '/api/local-components/extractor/retry',
      body: {},
      signal,
    }),
  );
  request.mockResolvedValue({ body: { status: 'unknown', error: 'native path' }, status: 200 });
  await expect(port.load(signal)).rejects.toMatchObject({ kind: 'invalid-response' });
});
