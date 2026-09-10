import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import express from 'express';
import {
  RECOVERY_JOURNAL_KEY_BYTES,
  RECOVERY_JOURNAL_MAX_CONTENT_BYTES,
  createRecoveryJournal,
} from '../recovery-journal.ts';
import { mount, type RecoveryDraftRouteDeps } from './recovery-drafts.ts';

const MEMBER = '/library/notes';
const NON_MEMBER = '/library/elsewhere';
const JSON_BODY_LIMIT = '10mb';

interface Harness {
  deps: RecoveryDraftRouteDeps;
  versions: Map<string, string>;
  dir: string;
  request(method: string, query: Record<string, string>, body?: unknown): Promise<{ status: number; body: any }>;
}

function harness(t: test.TestContext, key: Buffer | null = crypto.randomBytes(RECOVERY_JOURNAL_KEY_BYTES)): Promise<Harness> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'recovery-drafts-route-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const versions = new Map<string, string>();
  const deps: RecoveryDraftRouteDeps = {
    journal: createRecoveryJournal({ dir: path.join(dir, 'journal'), key }),
    memberFolderRoot: async (rawFolder) => (rawFolder === MEMBER ? MEMBER : null),
    currentVersion: async (folderRoot, relativePath) => {
      const version = versions.get(`${folderRoot}/${relativePath}`);
      if (version === 'throws') throw new Error('stat exploded');
      return version ?? null;
    },
  };
  const app = express();
  app.use(express.json({ limit: JSON_BODY_LIMIT }));
  mount(app, deps);
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  return new Promise((resolve) => {
    server.once('listening', () => {
      const address = server.address();
      assert.ok(address && typeof address === 'object');
      const base = `http://127.0.0.1:${address.port}`;
      resolve({
        deps,
        versions,
        dir,
        async request(method, query, body) {
          const suffix = method === 'CONTENT' ? '/content' : '';
          const url = new URL(`/api/recovery-drafts${suffix}`, base);
          for (const [name, value] of Object.entries(query)) url.searchParams.set(name, value);
          const response = await fetch(url, {
            method: method === 'CONTENT' ? 'GET' : method,
            headers: body === undefined ? {} : { 'content-type': 'application/json' },
            body: body === undefined ? undefined : JSON.stringify(body),
          });
          return { status: response.status, body: await response.json() };
        },
      });
    });
  });
}

const draft = (overrides: Record<string, unknown> = {}) => ({
  folderPath: MEMBER,
  path: 'daily/today.md',
  expectedVersion: 'sha256:base',
  content: '# unsaved',
  ...overrides,
});

test('write, list, read, and discard a draft through the folder-explicit routes', async (t) => {
  const { request, versions } = await harness(t);
  versions.set(`${MEMBER}/daily/today.md`, 'sha256:now');

  const written = await request('PUT', {}, draft());
  assert.equal(written.status, 200);
  assert.match(written.body.savedAt, /^\d{4}-\d{2}-\d{2}T/);
  const again = await request('PUT', {}, draft({ content: '# unsaved again' }));
  assert.equal(again.status, 200);

  const listed = await request('GET', { folder: MEMBER });
  assert.equal(listed.status, 200);
  assert.equal(listed.body.available, true);
  assert.equal(listed.body.drafts.length, 1, 'PUT twice keeps one entry');
  assert.deepEqual(listed.body.drafts[0], {
    currentVersion: 'sha256:now',
    expectedVersion: 'sha256:base',
    folderPath: MEMBER,
    path: 'daily/today.md',
    savedAt: again.body.savedAt,
  });
  assert.ok(!JSON.stringify(listed.body).includes('content'));

  const content = await request('CONTENT', { folder: MEMBER, path: 'daily/today.md' });
  assert.equal(content.status, 200);
  assert.equal(content.body.content, '# unsaved again');
  assert.equal(content.body.currentVersion, 'sha256:now');

  const first = await request('DELETE', { folder: MEMBER, path: 'daily/today.md' });
  const second = await request('DELETE', { folder: MEMBER, path: 'daily/today.md' });
  assert.deepEqual([first.status, second.status], [200, 200]);
  assert.deepEqual(first.body, {});
  assert.equal((await request('CONTENT', { folder: MEMBER, path: 'daily/today.md' })).status, 404);
  const empty = await request('GET', { folder: MEMBER });
  assert.deepEqual(empty.body, { available: true, drafts: [] });
});

test('a missing source and a failing version lookup both report currentVersion null', async (t) => {
  const { request, versions } = await harness(t);
  await request('PUT', {}, draft({ path: 'gone.md' }));
  await request('PUT', {}, draft({ path: 'broken.md' }));
  versions.set(`${MEMBER}/broken.md`, 'throws');
  const listed = await request('GET', { folder: MEMBER });
  assert.equal(listed.status, 200);
  assert.deepEqual(
    listed.body.drafts.map((entry: { path: string; currentVersion: string | null }) => [entry.path, entry.currentVersion]).sort(),
    [['broken.md', null], ['gone.md', null]],
  );
});

test('non-member folders are refused on every route', async (t) => {
  const { request } = await harness(t);
  const refused = { code: 'FOLDER_UNAVAILABLE', error: 'folder is not a registered library folder' };
  const queries: Record<string, string>[] = [{}, { folder: NON_MEMBER }, { folder: 'relative' }];
  for (const query of queries) {
    const listed = await request('GET', query);
    assert.equal(listed.status, 400);
    assert.deepEqual(listed.body, refused);
  }
  const content = await request('CONTENT', { folder: NON_MEMBER, path: 'a.md' });
  assert.equal(content.status, 400);
  assert.deepEqual(content.body, refused);
  const written = await request('PUT', {}, draft({ folderPath: NON_MEMBER }));
  assert.equal(written.status, 400);
  assert.deepEqual(written.body, refused);
  const discarded = await request('DELETE', { folder: NON_MEMBER, path: 'a.md' });
  assert.equal(discarded.status, 400);
  assert.deepEqual(discarded.body, refused);
});

test('parent, absolute, app-owned, and missing paths are refused as INVALID_PATH', async (t) => {
  const { request } = await harness(t);
  for (const bad of ['../escape.md', '/etc/passwd', 'C:\\secrets.txt', '.stashbase/state.json', '']) {
    const content = await request('CONTENT', { folder: MEMBER, path: bad });
    assert.equal(content.status, 400, `content ${bad}`);
    assert.equal(content.body.code, 'INVALID_PATH');
    const written = await request('PUT', {}, draft({ path: bad }));
    assert.equal(written.status, 400, `put ${bad}`);
    assert.equal(written.body.code, 'INVALID_PATH');
    const discarded = await request('DELETE', { folder: MEMBER, path: bad });
    assert.equal(discarded.status, 400, `delete ${bad}`);
    assert.equal(discarded.body.code, 'INVALID_PATH');
  }
  const noVersion = await request('PUT', {}, draft({ expectedVersion: '' }));
  assert.equal(noVersion.status, 400);
  assert.equal(noVersion.body.code, 'INVALID_PATH');
  const extraField = await request('PUT', {}, draft({ savedAt: 'client-chosen' }));
  assert.equal(extraField.status, 400);
});

test('paths are normalized before they key the journal', async (t) => {
  const { request } = await harness(t);
  await request('PUT', {}, draft({ path: 'daily//today.md' }));
  const content = await request('CONTENT', { folder: MEMBER, path: 'daily/today.md' });
  assert.equal(content.status, 200);
  const listed = await request('GET', { folder: MEMBER });
  assert.equal(listed.body.drafts[0].path, 'daily/today.md');
});

test('oversized drafts are refused as DRAFT_TOO_LARGE', async (t) => {
  const { request } = await harness(t);
  const atBound = await request('PUT', {}, draft({ content: 'x'.repeat(RECOVERY_JOURNAL_MAX_CONTENT_BYTES) }));
  assert.equal(atBound.status, 200);
  const overChars = await request('PUT', {}, draft({ content: 'x'.repeat(RECOVERY_JOURNAL_MAX_CONTENT_BYTES + 1) }));
  assert.equal(overChars.status, 413);
  assert.equal(overChars.body.code, 'DRAFT_TOO_LARGE');
  const overBytes = await request('PUT', {}, draft({ content: 'é'.repeat(RECOVERY_JOURNAL_MAX_CONTENT_BYTES / 2 + 1) }));
  assert.equal(overBytes.status, 413);
  assert.equal(overBytes.body.code, 'DRAFT_TOO_LARGE');
});

test('a journal without a key reports unavailable and stores nothing', async (t) => {
  const { request, dir } = await harness(t, null);
  const written = await request('PUT', {}, draft());
  assert.equal(written.status, 503);
  assert.deepEqual(written.body, {
    code: 'RECOVERY_UNAVAILABLE',
    error: 'draft recovery is unavailable on this installation',
  });
  const listed = await request('GET', { folder: MEMBER });
  assert.equal(listed.status, 200);
  assert.deepEqual(listed.body, { available: false, reason: 'no-key' });
  const content = await request('CONTENT', { folder: MEMBER, path: 'daily/today.md' });
  assert.equal(content.status, 503);
  const discarded = await request('DELETE', { folder: MEMBER, path: 'daily/today.md' });
  assert.equal(discarded.status, 200);
  assert.equal(fs.existsSync(path.join(dir, 'journal')), false);
});
