import { expect, test } from '@playwright/test';
import type { Route } from 'playwright';
import type { LaunchedApp } from '../support/app.ts';
import { launchApp } from '../support/app.ts';
import { createAppFixture } from '../support/fixtures.ts';
import { openLibraryFolder } from '../support/locators.ts';
import { primaryKey } from './journey-helpers.ts';

test('semantic search UI renders deterministic loading, grouped, empty, and error states', async ({}, testInfo) => {
  const fixture = await createAppFixture({ membership: 'two-folders' });
  let releaseGrouped: (() => void) | undefined;
  const groupedGate = new Promise<void>((resolve) => { releaseGrouped = resolve; });
  let app: LaunchedApp | undefined;
  try {
    app = await launchApp(fixture, testInfo);
    await app.page.route('**/api/embedder', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        provider: 'openai', hasKey: true, model: 'fixture-model',
      }) });
    });
    await app.page.route('**/api/library/search', async (route: Route) => {
      const body = route.request().postDataJSON() as { query?: string };
      if (body.query === 'grouped fixture') {
        await groupedGate;
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ hits: [
          {
            fileName: `${fixture.workspaces.projectA}/Welcome.md`,
            chunkIndex: 0,
            content: '# Alpha evidence\nGrouped semantic alpha.',
            heading: 'Alpha evidence',
            startLine: 1,
            endLine: 2,
            score: 0.91,
          },
          {
            fileName: `${fixture.workspaces.projectB}/Notes.md`,
            chunkIndex: 0,
            content: '# Beta evidence\nGrouped semantic beta.',
            heading: 'Beta evidence',
            startLine: 1,
            endLine: 2,
            score: 0.82,
          },
        ] }) });
        return;
      }
      if (body.query === 'empty fixture') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ hits: [] }) });
        return;
      }
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'semantic fixture unavailable' }),
      });
    });

    await openLibraryFolder(app.page, 'project-alpha');
    await app.page.keyboard.press(`${primaryKey}+Shift+F`);
    const search = app.page.getByRole('dialog', { name: 'Search library' });
    const input = search.getByRole('combobox');
    await input.fill('grouped fixture');
    await expect(search.getByText('Searching…')).toBeVisible();
    releaseGrouped?.();
    await expect(search.getByText('project-alpha', { exact: true })).toBeVisible();
    await expect(search.getByText('project-beta', { exact: true })).toBeVisible();
    await expect(search.getByRole('option', { name: /Welcome\.md.*Grouped semantic alpha/ })).toBeVisible();
    await expect(search.getByRole('option', { name: /Notes\.md.*Grouped semantic beta/ })).toBeVisible();

    await input.fill('empty fixture');
    await expect(search.getByText('No matches', { exact: true })).toBeVisible();
    await input.fill('error fixture');
    await expect(search.getByText('Search failed: semantic fixture unavailable')).toBeVisible();
    expect(app.errors.records).toEqual([expect.objectContaining({
      kind: 'console',
      text: 'Failed to load resource: the server responded with a status of 503 (Service Unavailable)',
    })]);
  } finally {
    await app?.close();
    await fixture.cleanup();
  }
});

// Intent: removing the API key re-gates AI Index IMMEDIATELY — the setup
// dialog re-offers while the folder is still open, instead of waiting for
// the next folder switch. Fully route-stubbed: no real key or provider.
test('removing the API key re-offers the AI Index dialog right away', async ({}, testInfo) => {
  const fixture = await createAppFixture({ membership: 'two-folders' });
  let app: LaunchedApp | undefined;
  try {
    app = await launchApp(fixture, testInfo);
    let hasKey = true;
    await app.page.route('**/api/embedder', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        provider: 'openai', hasKey, model: 'fixture-model',
      }) });
    });
    await app.page.route('**/api/embedder/key', async (route) => {
      hasKey = false;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        hasKey: false, provider: 'openai', model: 'fixture-model',
      }) });
    });

    const skip = app.page.getByRole('button', { name: 'Skip AI Index for now', exact: true });
    await openLibraryFolder(app.page, 'project-alpha');
    // Keyed: no prompt.
    await app.page.waitForTimeout(1200);
    await expect(skip).toBeHidden();

    // Remove the key through Settings.
    await app.page.getByRole('button', { name: 'Settings', exact: true }).click();
    await app.page.getByRole('tab', { name: 'AI Index' }).click();
    await app.page.getByRole('button', { name: 'Remove key…' }).click();
    await app.page.getByRole('button', { name: 'Remove key', exact: true }).click();

    // The gate re-evaluates on the key-state change: the dialog re-offers
    // now, not on the next folder switch.
    await expect(skip).toBeVisible();
    app.errors.assertNone();
  } finally {
    await app?.close();
    await fixture.cleanup();
  }
});
