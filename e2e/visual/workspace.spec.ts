import { expect, test } from '@playwright/test';
import { fileTreeRow, folderSwitcherTrigger } from '../support/locators.ts';
import {
  dismissEmbeddingSetup,
  expectLinuxScreenshot,
  launchVisualApp,
  openFixtureFolder,
  setVisualViewport,
} from './visual-helpers.ts';

test('active-folder workspace shell keeps its redesigned composition', async ({}, testInfo) => {
  const visual = await launchVisualApp('one-folder', testInfo);
  try {
    const { page } = visual.app;
    await setVisualViewport(page, 1280, 820);
    await openFixtureFolder(page);
    await dismissEmbeddingSetup(page);

    await expect(page.getByRole('complementary', { name: 'Agent chat' }).getByRole('tab', { selected: true })).toBeInViewport();
    await expect(page.locator('aside.sidebar')).toBeVisible();
    await expect(page.locator('#sideHead')).toContainText('project-alpha');
    await expect(fileTreeRow(page, 'nested')).toBeVisible();
    // The titlebar folder switcher carries the window's folder identity.
    await expect(folderSwitcherTrigger(page)).toBeVisible();
    await expect(folderSwitcherTrigger(page)).toContainText('project-alpha');
    await expect(page.getByRole('status').filter({ hasText: 'Codex is not installed' })).toBeVisible();

    await expectLinuxScreenshot(page, 'workspace-folder.png');
  } finally {
    await visual.close();
  }
});

test('empty library keeps the redesigned zero-state composition', async ({}, testInfo) => {
  const visual = await launchVisualApp('empty', testInfo);
  try {
    const { page } = visual.app;
    await setVisualViewport(page, 1280, 820);

    await expect(page.getByRole('complementary', { name: 'Agent chat' }).getByRole('tab', { selected: true })).toBeInViewport();
    await expect(page.getByText('Add a folder to build your searchable library.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Folder…' })).toBeVisible();
    // With no folder open the switcher trigger reads "Library".
    await expect(folderSwitcherTrigger(page)).toContainText('Library');
    await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Codex is not installed' })).toBeVisible();

    await expectLinuxScreenshot(page, 'workspace-empty.png');
  } finally {
    await visual.close();
  }
});
