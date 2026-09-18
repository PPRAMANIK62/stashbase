import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { documentTabsRuntimeOptions, sourceApi, textSource } from '@/test/fakes/documents';

import { openDocumentRevision } from './open-revision';
import type { DocumentRevisionProposal } from './ports';
import { createDocumentTabsRuntime } from './tabs-runtime';

const folderPath = '/project/notes';
const BASE = '# Plan\n';
const BASE_VERSION = 'sha256:v1';

const open: Array<{ dispose(): void }> = [];

afterEach(() => {
  vi.useRealTimers();
  for (const runtime of open.splice(0)) runtime.dispose();
});

function proposal(overrides: Partial<DocumentRevisionProposal> = {}): DocumentRevisionProposal {
  return {
    id: 'review-1',
    baseVersion: BASE_VERSION,
    content: '# Revised plan\n',
    createdAt: 0,
    origin: { kind: 'agent' },
    source: { folderPath, path: 'plan.md' },
    ...overrides,
  };
}

async function openDocument() {
  const documents = createDocumentTabsRuntime(
    documentTabsRuntimeOptions({ api: sourceApi(), folderPath }),
  );
  open.push(documents);
  const document = await documents.open({ folderPath, path: 'plan.md' });
  if (!document) throw new Error('Expected the document to open.');
  return document;
}

function openRevision(document: Awaited<ReturnType<typeof openDocument>>, proposed = proposal()) {
  return openDocumentRevision(
    document,
    proposed,
    sourceApi({
      load: vi.fn(async () =>
        textSource({
          content: document.store.getState().editor?.value ?? BASE,
          version: document.store.getState().editor?.version ?? BASE_VERSION,
        }),
      ),
    }),
  );
}

describe('opening a parked revision on a document', () => {
  it('starts the review once the tab reports text, however late that is', async () => {
    const document = await openDocument();
    const started = openRevision(document);

    document.reconcile(textSource({ content: BASE, version: BASE_VERSION }));

    await expect(started).resolves.toBeNull();
    const revision = document.store.getState().revision;
    expect(revision.kind === 'idle' ? null : revision.review.id).toBe('review-1');
  });

  it('strips frontmatter from both sides, so the parser never sees a delimiter', async () => {
    const document = await openDocument();
    document.reconcile(textSource({ content: `---\ntitle: Plan\n---\n${BASE}`, version: 'v2' }));

    await expect(
      openRevision(
        document,
        proposal({ baseVersion: 'v2', content: `---\ntitle: Plan\n---\n# Revised\n` }),
      ),
    ).resolves.toBeNull();

    const revision = document.store.getState().revision;
    expect(revision.kind === 'idle' ? null : revision.review.proposal).toBe('# Revised\n');
  });

  it('refuses frontmatter edits rather than silently dropping them', async () => {
    const document = await openDocument();
    document.reconcile(textSource({ content: `---\ntitle: Plan\n---\n${BASE}`, version: 'v2' }));

    await expect(
      openRevision(
        document,
        proposal({ baseVersion: 'v2', content: '---\ntitle: Revised\n---\n# Revised\n' }),
      ),
    ).resolves.toBe('frontmatter-changed');
    expect(document.store.getState().revision).toEqual({ kind: 'idle' });
  });

  it('gives up on a tab whose text never arrives', async () => {
    vi.useFakeTimers();
    const document = await openDocument();
    const started = openRevision(document);

    await vi.advanceTimersByTimeAsync(20_000);

    await expect(started).resolves.toBe('not-opened');
    expect(document.store.getState().revision).toEqual({ kind: 'idle' });
  });

  it('gives up when the document is torn down while the text is still loading', async () => {
    const document = await openDocument();
    const started = openRevision(document);

    document.dispose();

    await expect(started).resolves.toBe('not-opened');
  });

  it('gives up immediately on a document that was already disposed', async () => {
    const document = await openDocument();
    document.dispose();

    await expect(openRevision(document)).resolves.toBe('not-opened');
  });

  it('reports the domain refusal rather than opening a second review', async () => {
    const document = await openDocument();
    document.reconcile(textSource({ content: BASE, version: BASE_VERSION }));

    await expect(openRevision(document)).resolves.toBeNull();
    await expect(openRevision(document)).resolves.toBe('review-in-progress');
  });

  it('reports a proposal written against text the document has moved past', async () => {
    const document = await openDocument();
    document.reconcile(textSource({ content: BASE, version: 'sha256:v9' }));

    await expect(openRevision(document)).resolves.toBe('stale-version');
  });

  it('refuses when the source moved on disk while the editor still shows its old version', async () => {
    const document = await openDocument();
    document.reconcile(textSource({ content: BASE, version: BASE_VERSION }));
    const current = sourceApi({
      load: vi.fn(async () => textSource({ content: '# Newer on disk\n', version: 'sha256:v9' })),
    });

    await expect(openDocumentRevision(document, proposal(), current)).resolves.toBe(
      'stale-version',
    );
    expect(document.store.getState().revision).toEqual({ kind: 'idle' });
  });

  it('reports uncertainty when the current source cannot be checked', async () => {
    const document = await openDocument();
    document.reconcile(textSource({ content: BASE, version: BASE_VERSION }));
    const unavailable = sourceApi({
      load: vi.fn(async () => {
        throw new Error('offline');
      }),
    });

    await expect(openDocumentRevision(document, proposal(), unavailable)).resolves.toBe(
      'not-verified',
    );
    expect(document.store.getState().revision).toEqual({ kind: 'idle' });
  });
});
