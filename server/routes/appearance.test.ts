import assert from 'node:assert/strict';
import { test } from 'node:test';

import express from 'express';

import { mount } from './appearance.ts';

const THEMES: readonly unknown[] = ['system', 'light', 'dark'];
const SCALES: readonly unknown[] = ['small', 'default', 'large'];

interface AppearanceBody {
  readingTextSize: unknown;
  theme: unknown;
  uiScale: unknown;
}

async function withRoute<T>(read: (url: string) => Promise<T>): Promise<T> {
  const app = express();
  app.use(express.json());
  mount(app);
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  try {
    return await read(`http://127.0.0.1:${port}/api/appearance`);
  } finally {
    server.close();
  }
}

function put(body: unknown): Promise<number> {
  return withRoute(async (url) => {
    const res = await fetch(url, {
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
      method: 'PUT',
    });
    return res.status;
  });
}

function get(): Promise<{ body: unknown; status: number }> {
  return withRoute(async (url) => {
    const res = await fetch(url);
    return { body: await res.json(), status: res.status };
  });
}

function presetsOf(value: unknown): AppearanceBody {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('theme' in value) ||
    !('uiScale' in value) ||
    !('readingTextSize' in value)
  ) {
    return assert.fail('the read answers with all three appearance presets');
  }
  return {
    readingTextSize: value.readingTextSize,
    theme: value.theme,
    uiScale: value.uiScale,
  };
}

// There is no accepted-write test: `CONFIG_DIR` in app config has no test
// override, so the 200 path would rewrite the real user config. Each refusal is
// also the proof the durable writer was never reached, because the route
// answers before it calls into app config.
test('a theme outside the three presets is refused rather than written', async () => {
  assert.equal(await put({ theme: 'midnight' }), 400);
});

test('an interface size outside the three presets is refused', async () => {
  assert.equal(await put({ uiScale: 'huge' }), 400);
});

test('a reading text size outside the three presets is refused', async () => {
  assert.equal(await put({ readingTextSize: 'tiny' }), 400);
});

test('a read answers with every preset inside its own allowed values', async () => {
  const read = await get();
  assert.equal(read.status, 200);
  const presets = presetsOf(read.body);
  assert.ok(THEMES.includes(presets.theme), `theme ${String(presets.theme)}`);
  assert.ok(SCALES.includes(presets.uiScale), `uiScale ${String(presets.uiScale)}`);
  assert.ok(
    SCALES.includes(presets.readingTextSize),
    `readingTextSize ${String(presets.readingTextSize)}`,
  );
});
