import type { ElectronApplication, Page } from 'playwright';
import { openFolderSwitcher } from '../support/locators.ts';

export const primaryKey = process.platform === 'darwin' ? 'Meta' : 'Control';

/** Reach the native folder picker through the titlebar folder switcher —
 *  the add-folder flows sit at the top of its menu. */
export async function openFolderPickerMenu(page: Page): Promise<void> {
  await openFolderSwitcher(page);
  await page.getByRole('menuitem', { name: 'Open Folder…' }).click();
}

export async function stubOpenFolderDialog(
  electron: ElectronApplication,
  result: { kind: 'success'; path: string } | { kind: 'cancel' } | { kind: 'error'; message: string },
): Promise<void> {
  await electron.evaluate(({ dialog }, next) => {
    dialog.showOpenDialog = async () => {
      if (next.kind === 'error') throw new Error(next.message);
      if (next.kind === 'cancel') return { canceled: true, filePaths: [] };
      return { canceled: false, filePaths: [next.path] };
    };
  }, result);
}

export async function stubExternalBrowser(electron: ElectronApplication): Promise<void> {
  await electron.evaluate(({ shell }) => {
    (globalThis as { __stashbaseOpenedExternal?: string[] }).__stashbaseOpenedExternal = [];
    shell.openExternal = async (url: string) => {
      (globalThis as { __stashbaseOpenedExternal?: string[] }).__stashbaseOpenedExternal?.push(url);
    };
  });
}

export async function openedExternalUrls(electron: ElectronApplication): Promise<string[]> {
  return electron.evaluate(() => (
    (globalThis as { __stashbaseOpenedExternal?: string[] }).__stashbaseOpenedExternal ?? []
  ));
}
