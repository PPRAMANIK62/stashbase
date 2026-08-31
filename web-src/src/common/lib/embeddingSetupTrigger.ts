/** How any surface asks the AI setup dialog to open manually — the Files-panel
 * Enable entry, Similar Search, or Settings. Mirrors `settingsTrigger`; the gate
 * that listens stays in the Settings feature, and the alternative is
 * threading a callback from the app root down to a lazily-loaded card. */

export const OPEN_EMBEDDING_SETUP_EVENT = 'stashbase-open-embedding-setup';

export function openEmbeddingSetup(): void {
  window.dispatchEvent(new CustomEvent(OPEN_EMBEDDING_SETUP_EVENT));
}
