import fs from 'node:fs';
import { expect, test } from '@playwright/test';
import type { LaunchedApp } from '../support/app.ts';
import { launchApp } from '../support/app.ts';
import { createAppFixture } from '../support/fixtures.ts';
import {
  appearanceChoice,
  dismissEmbeddingKeyPrompt,
  openLibraryFolder,
  settingsButton,
  settingsDialog,
  settingsTab,
} from '../support/locators.ts';

test('user can navigate Settings and persist appearance across relaunch', async ({}, testInfo) => {
  const fixture = await createAppFixture({ membership: 'empty' });
  let app: LaunchedApp | undefined;
  try {
    app = await launchApp(fixture, testInfo);
    await settingsButton(app.page).click();
    await expect(settingsDialog(app.page)).toBeVisible();
    await expect(settingsTab(app.page, 'Appearance')).toHaveAttribute('aria-selected', 'true');

    for (const section of ['General', 'AI Index', 'Transcription', 'MCP', 'Appearance']) {
      await settingsTab(app.page, section).click();
      await expect(settingsTab(app.page, section)).toHaveAttribute('aria-selected', 'true');
    }

    await appearanceChoice(app.page, 'Theme', 'Dark').click();
    await expect(app.page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await appearanceChoice(app.page, 'Interface size', 'Large').click();
    await expect(app.page.locator('html')).toHaveAttribute('data-ui-scale', 'large');
    await app.page.getByRole('button', { name: 'Close settings' }).click();
    await expect(settingsDialog(app.page)).toBeHidden();

    const persisted = JSON.parse(fs.readFileSync(fixture.configFile, 'utf8')) as {
      appearance?: { theme?: string; uiScale?: string };
    };
    expect(persisted.appearance).toMatchObject({ theme: 'dark', uiScale: 'large' });

    app = await app.relaunch();
    await expect(app.page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(app.page.locator('html')).toHaveAttribute('data-ui-scale', 'large');
    await settingsButton(app.page).click();
    await expect(appearanceChoice(app.page, 'Theme', 'Dark')).toHaveAttribute('data-pressed');
    await expect(appearanceChoice(app.page, 'Interface size', 'Large')).toHaveAttribute('data-pressed');
    app.errors.assertNone();
  } finally {
    await app?.close();
    await fixture.cleanup();
  }
});

test('clipboard screenshot offers are default-off and require an explicit General setting', async ({}, testInfo) => {
  const fixture = await createAppFixture({ membership: 'one-folder' });
  let app: LaunchedApp | undefined;
  try {
    app = await launchApp(fixture, testInfo);
    await openLibraryFolder(app.page, 'project-alpha');
    await dismissEmbeddingKeyPrompt(app.page);

    const imageReady = await app.electron.evaluate(({ clipboard, nativeImage }) => {
      const image = nativeImage.createFromDataURL(
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      );
      clipboard.writeImage(image);
      return !image.isEmpty();
    });
    expect(imageReady).toBe(true);
    await app.page.bringToFront();
    await app.page.waitForTimeout(800);
    await expect(app.page.getByRole('dialog', { name: 'Add image to StashBase?' })).toHaveCount(0);

    await settingsButton(app.page).click();
    await settingsTab(app.page, 'General').click();
    const clipboardCapture = settingsDialog(app.page).getByRole('checkbox', {
      name: 'Offer to add clipboard screenshots',
    });
    await expect(clipboardCapture).not.toBeChecked();
    await clipboardCapture.check();

    const offer = app.page.getByRole('dialog', { name: 'Add image to StashBase?' });
    await expect(offer).toBeVisible();
    await offer.getByRole('button', { name: 'Dismiss' }).click();
    await expect(offer).toBeHidden();

    const persisted = JSON.parse(fs.readFileSync(fixture.configFile, 'utf8')) as {
      capture?: { clipboardImageImport?: boolean };
    };
    expect(persisted.capture?.clipboardImageImport).toBe(true);
    app.errors.assertNone();
  } finally {
    try {
      await app?.electron.evaluate(({ clipboard }) => clipboard.clear());
    } catch { /* Electron may already be closed after a failed assertion. */ }
    await app?.close();
    await fixture.cleanup();
  }
});
