import { expect, test } from '@playwright/test';
import type { LaunchedApp } from '../support/app.ts';
import { launchApp } from '../support/app.ts';
import { createAppFixture } from '../support/fixtures.ts';
import {
  activeDocument,
  activeDocumentTab,
  documentTab,
  dismissEmbeddingKeyPrompt,
  fileTreeRow,
  openFolderSwitcher,
  quickOpenDialog,
  switcherFolderItem,
  quickOpenInput,
} from '../support/locators.ts';

test('user can navigate folders, files, Quick Open, and persistent tabs', async ({}, testInfo) => {
  const fixture = await createAppFixture({ membership: 'two-folders' });
  let app: LaunchedApp | undefined;
  try {
    app = await launchApp(fixture, testInfo);
    // Library membership is visible in the titlebar folder switcher's menu.
    await openFolderSwitcher(app.page);
    await expect(switcherFolderItem(app.page, 'project-alpha')).toBeVisible();
    await expect(switcherFolderItem(app.page, 'project-beta')).toBeVisible();

    await switcherFolderItem(app.page, 'project-alpha').click();
    await expect(app.page).toHaveTitle('project-alpha — StashBase');
    await expect(fileTreeRow(app.page, 'Welcome.md')).toBeVisible();
    await dismissEmbeddingKeyPrompt(app.page);

    await fileTreeRow(app.page, 'Welcome.md').click();
    await expect(documentTab(app.page, 'Welcome.md')).toBeVisible();
    await expect(activeDocument(app.page)).toContainText('Welcome to Project Alpha');

    await app.page.keyboard.press(process.platform === 'darwin' ? 'Meta+O' : 'Control+O');
    await expect(quickOpenDialog(app.page)).toBeVisible();
    await expect(quickOpenInput(app.page)).toBeFocused();
    await quickOpenInput(app.page).fill('Second Note');
    await app.page.getByRole('option', { name: /Second Note\.md/ }).click();
    await expect(quickOpenDialog(app.page)).toBeHidden();
    await expect(activeDocumentTab(app.page)).toHaveAttribute('title', 'Second Note.md');
    await expect(activeDocument(app.page)).toContainText('Opened through Quick Open');

    await documentTab(app.page, 'Welcome.md').click();
    await expect(activeDocumentTab(app.page)).toHaveAttribute('title', 'Welcome.md');
    await expect(activeDocument(app.page)).toContainText('Alpha smoke fixture content');
    app.errors.assertNone();
  } finally {
    await app?.close();
    await fixture.cleanup();
  }
});
