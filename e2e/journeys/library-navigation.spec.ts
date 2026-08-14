import { expect, test } from '@playwright/test';
import type { LaunchedApp } from '../support/app.ts';
import { launchApp } from '../support/app.ts';
import { createAppFixture } from '../support/fixtures.ts';
import {
  activeDocument,
  activeDocumentTab,
  closeFolderSwitcher,
  dismissEmbeddingKeyPrompt,
  documentTab,
  fileTreeRow,
  openFolderSwitcher,
  openLibraryFolder,
  quickOpenDialog,
  quickOpenInput,
  switcherFolderItem,
} from '../support/locators.ts';
import { seedJourneyWorkspaces } from '../fixtures/journey-workspaces.ts';
import { primaryKey } from './journey-helpers.ts';

// Intent preserved: switching the window's folder resets the workspace
// (tabs and tree) while the whole library membership stays reachable —
// now through the titlebar folder switcher instead of the retired
// sidebar Library section rows.
test('folder switching resets the workspace while library membership remains available', async ({}, testInfo) => {
  const fixture = await createAppFixture({ membership: 'two-folders' });
  seedJourneyWorkspaces(fixture);
  let app: LaunchedApp | undefined;
  try {
    app = await launchApp(fixture, testInfo);
    await openLibraryFolder(app.page, 'project-alpha');
    await dismissEmbeddingKeyPrompt(app.page);
    await fileTreeRow(app.page, 'Welcome.md').click();
    await expect(activeDocument(app.page)).toContainText('Project Alpha');
    await expect(app.page.getByRole('tab', { name: 'Welcome.md' })).toHaveAttribute('aria-selected', 'true');

    await openLibraryFolder(app.page, 'project-beta');
    await expect(app.page).toHaveTitle('project-beta — StashBase');
    await dismissEmbeddingKeyPrompt(app.page);
    await expect(fileTreeRow(app.page, 'Notes.md')).toBeVisible();
    await expect(fileTreeRow(app.page, 'Second Note.md')).toHaveCount(0);
    // Membership remains available after the switch: the switcher menu
    // lists both members (the current folder stays listed with a check).
    await openFolderSwitcher(app.page);
    await expect(switcherFolderItem(app.page, 'project-alpha')).toBeVisible();
    await expect(switcherFolderItem(app.page, 'project-beta')).toBeVisible();
    await closeFolderSwitcher(app.page);
    await expect(documentTab(app.page, 'Welcome.md')).toHaveCount(0);
    app.errors.assertNone();
  } finally {
    await app?.close();
    await fixture.cleanup();
  }
});

// Intent preserved: document tabs persist, Quick Open and the Command
// Palette stay keyboard-operable, and dismissing them restores focus.
// Folder entry goes through the titlebar switcher; the flow inside the
// workspace is unchanged.
test('persistent document tabs and Quick Open remain keyboard-operable and restore focus', async ({}, testInfo) => {
  const fixture = await createAppFixture({ membership: 'one-folder' });
  let app: LaunchedApp | undefined;
  try {
    app = await launchApp(fixture, testInfo);
    await openLibraryFolder(app.page, 'project-alpha');
    await dismissEmbeddingKeyPrompt(app.page);
    const welcome = fileTreeRow(app.page, 'Welcome.md');
    await welcome.click();
    await welcome.focus();
    await app.page.keyboard.press(`${primaryKey}+O`);
    await expect(quickOpenDialog(app.page)).toBeVisible();
    await expect(quickOpenInput(app.page)).toBeFocused();
    await quickOpenInput(app.page).press('Escape');
    await expect(quickOpenDialog(app.page)).toBeHidden();
    await expect(welcome).toBeFocused();

    await app.page.keyboard.press(`${primaryKey}+O`);
    await quickOpenInput(app.page).fill('Second Note');
    await quickOpenInput(app.page).press('Enter');
    await expect(activeDocumentTab(app.page)).toHaveAttribute('title', 'Second Note.md');
    await expect(app.page.getByRole('tab', { name: 'Second Note.md' })).toHaveAttribute('aria-selected', 'true');
    await expect(documentTab(app.page, 'Welcome.md')).toBeVisible();

    await app.page.keyboard.press('F1');
    const palette = app.page.getByRole('dialog', { name: 'Command Palette' });
    await expect(palette).toBeVisible();
    const commandInput = palette.getByRole('combobox');
    await commandInput.fill('>Find in document');
    await commandInput.press('Enter');
    await expect(app.page.getByRole('search', { name: 'Find in document' })).toBeVisible();
    await app.page.keyboard.press('Escape');
    await expect(app.page.getByRole('search', { name: 'Find in document' })).toBeHidden();

    await app.page.getByRole('button', { name: 'Close Welcome.md' }).click();
    await expect(documentTab(app.page, 'Welcome.md')).toHaveCount(0);
    await expect(activeDocumentTab(app.page)).toHaveAttribute('title', 'Second Note.md');
    app.errors.assertNone();
  } finally {
    await app?.close();
    await fixture.cleanup();
  }
});

// Intent: J01 — a fresh window with neither a key nor a signed-in account
// offers AI Index setup right away; the offer does not wait for a folder.
// One launch is one offer: a bare-window skip covers the FIRST folder
// opened afterwards. Past that the offer follows the FOLDER, not the
// window — a different folder re-offers, while returning to a folder
// skipped in this window stays quiet (in-place switching through the
// titlebar switcher is the primary flow now).
test('the AI Index prompt offers at launch, follows folders, and stays quiet on return', async ({}, testInfo) => {
  const fixture = await createAppFixture({ membership: 'two-folders' });
  let app: LaunchedApp | undefined;
  try {
    app = await launchApp(fixture, testInfo, { aiIndexSetup: 'preserve' });
    const skip = app.page.getByRole('button', { name: 'Skip AI Index for now', exact: true });

    // The fresh bare window makes the offer before any folder is chosen.
    await expect(skip).toBeVisible();
    await skip.click();
    await expect(skip).toBeHidden();

    // The bare-window skip carries into the first folder — no double nag
    // seconds after an explicit "not now".
    await openLibraryFolder(app.page, 'project-alpha');
    await expect(app.page).toHaveTitle('project-alpha — StashBase');
    await app.page.waitForTimeout(1500);
    await expect(skip).toBeHidden();

    // A DIFFERENT folder re-offers: skipping one folder must not silence
    // the rest of the library.
    await openLibraryFolder(app.page, 'project-beta');
    await expect(skip).toBeVisible();
    await skip.click();
    await expect(skip).toBeHidden();

    // Returning to a folder skipped in this window does not re-nag.
    await openLibraryFolder(app.page, 'project-alpha');
    await expect(app.page).toHaveTitle('project-alpha — StashBase');
    await app.page.waitForTimeout(1500);
    await expect(skip).toBeHidden();
    app.errors.assertNone();
  } finally {
    await app?.close();
    await fixture.cleanup();
  }
});
