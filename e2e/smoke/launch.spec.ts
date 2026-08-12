import { expect, test } from '@playwright/test';
import type { LaunchedApp } from '../support/app.ts';
import { launchApp } from '../support/app.ts';
import { createAppFixture } from '../support/fixtures.ts';
import { appShell, folderButton, settingsButton } from '../support/locators.ts';

test('user can launch into the empty library workspace', async ({}, testInfo) => {
  const fixture = await createAppFixture({ membership: 'empty' });
  let app: LaunchedApp | undefined;
  try {
    app = await launchApp(fixture, testInfo);
    await expect(app.page).toHaveTitle('StashBase');
    await expect(appShell(app.page)).toBeVisible();
    await expect(app.page.getByRole('button', { name: 'New Chat', exact: true })).toBeVisible();
    await expect(settingsButton(app.page)).toBeVisible();
    await expect(app.page.getByText('Add a folder to build your searchable library.')).toBeVisible();
    await expect(app.page.getByRole('complementary', { name: 'Agent chat' })).toBeVisible();
    app.errors.assertNone();
  } finally {
    await app?.close();
    await fixture.cleanup();
}

test('user launches an existing library with Chat expanded', async ({}, testInfo) => {
  const fixture = await createAppFixture({ membership: 'one-folder' });
  let app: LaunchedApp | undefined;
  try {
    app = await launchApp(fixture, testInfo);
    const chat = app.page.getByRole('complementary', { name: 'Agent chat' });
    await expect(chat).toBeVisible();
    await folderButton(app.page, 'project-alpha').click();
    await expect(chat).toBeVisible();
    app.errors.assertNone();
  } finally {
    await app?.close();
    await fixture.cleanup();
  }
});
});
