/**
 * Whether AI Index is authorized, whether the user has deliberately opted
 * out of it, and the one place that decides both.
 *
 * Today the only way to authorize is a provider API key the user pasted in.
 * A signed-in account is meant to become a second way, and the point of
 * this module is that adding it is ONE edit here rather than an audit of
 * every `!hasKey` in the renderer — the dialog, the Files-panel line, the
 * settings panel, and the sidebar all ask this question, and they must
 * never disagree about the answer.
 */
import type { EmbedderState } from '../../api';

export function isEmbeddingAuthorized(state: EmbedderState | null | undefined): boolean {
  if (!state) return false;
  return state.hasKey;
}

/**
 * "Basic mode": the user was offered AI Index and declined for now.
 *
 * Deliberately in-memory and PER FOLDER within this window — not
 * persisted — so "for now" stays literal on both axes: a relaunch or a
 * new window offers indexing again, and with the titlebar switcher
 * making in-place folder switching the primary flow, opening a
 * DIFFERENT folder re-offers too (a window-wide skip silently became
 * "skip forever" in a long-lived window). Only switching back to a
 * folder already skipped in this window stays quiet. It never becomes
 * a standing machine-wide opt-out; browsing, editing, preview, and
 * keyword search all keep working meanwhile, and the Files-panel
 * "Set up AI Index" entry is the calm route back.
 *
 * Cleared on successful activation, so removing the key later re-gates
 * from a clean state rather than silently staying skipped.
 */
const skippedFolders = new Set<string>();

export function hasSkippedAiIndexing(folder: string): boolean {
  return skippedFolders.has(folder);
}

export function setAiIndexingSkipped(skipped: boolean, folder: string): void {
  if (skipped) skippedFolders.add(folder);
  else skippedFolders.clear();
}
