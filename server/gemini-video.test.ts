import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'stashbase-gemini-video-home-'));
process.env.HOME = home;
process.env.STASHBASE_LOCAL_DATA_ROOT = path.join(home, 'app-data');

test('analyzeVideoWithGemini deletes an uploaded file when processing fails', async () => {
  const { setGeminiKey } = await import('./app-config.ts');
  const { analyzeVideoWithGemini } = await import('./gemini-video.ts');
  setGeminiKey('gemini-test-key');
  const video = path.join(home, 'recording.webm');
  fs.writeFileSync(video, 'webm');
  const calls: Array<{ url: string; method: string; hasSignal: boolean }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (...args: Parameters<typeof fetch>): Promise<Response> => {
    const [input, init] = args;
    const url = String(input);
    const method = init?.method ?? 'GET';
    calls.push({ url, method, hasSignal: init?.signal instanceof AbortSignal });
    if (url.includes('/upload/v1beta/files') && method === 'POST') {
      return new Response('', {
        status: 200,
        headers: { 'x-goog-upload-url': 'https://upload.example/session' },
      });
    }
    if (url === 'https://upload.example/session' && method === 'POST') {
      return Response.json({
        file: {
          name: 'files/stashbase-test-file',
          uri: 'gemini://stashbase-test-file',
          mimeType: 'video/webm',
          state: 'FAILED',
        },
      });
    }
    if (url.includes('/v1beta/files/stashbase-test-file') && method === 'DELETE') {
      return new Response('', { status: 200 });
    }
    return new Response('unexpected request', { status: 500 });
  }) as typeof fetch;

  try {
    await assert.rejects(
      () => analyzeVideoWithGemini(video, 'video/webm'),
      /Gemini file not ACTIVE/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(
    calls.some((call) => call.method === 'DELETE' && call.url.includes('/v1beta/files/stashbase-test-file')),
    true,
  );
  assert.equal(calls.every((call) => call.hasSignal), true);
});
