/**
 * Whether AI Index is authorized, whether the one-time setup invitation has
 * already been handled, and the one place that decides both.
 *
 * A signed-in account allowance and a provider API key are equal activation
 * sources. The server resolves the explicit active source and exposes the
 * resulting `authorized` fact so the dialog, Files-panel line, Settings, and
 * search never disagree.
 */
import type { EmbedderState } from '@/common/api/api';

export function isEmbeddingAuthorized(state: EmbedderState | null | undefined): boolean {
  if (!state) return false;
  return state.authorized;
}

/** The first-folder setup is a one-time invitation, not a per-folder nag.
 * Completing or declining it records a durable renderer preference; the
 * standing Files-panel action and Settings remain available if AI is off. */
const AI_SETUP_SEEN_KEY = 'stashbase.ai-setup-seen';

export interface AiSetupPreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function browserStorage(): AiSetupPreferenceStorage | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function hasSeenAiSetup(
  storage: AiSetupPreferenceStorage | undefined = browserStorage(),
): boolean {
  try {
    return storage?.getItem(AI_SETUP_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function setAiSetupSeen(
  seen: boolean,
  storage: AiSetupPreferenceStorage | undefined = browserStorage(),
): void {
  try {
    if (seen) storage?.setItem(AI_SETUP_SEEN_KEY, '1');
    else storage?.removeItem(AI_SETUP_SEEN_KEY);
  } catch {
    // Hardened WebViews may reject localStorage. The setup can reappear on a
    // later launch, but browsing and exact search still remain available.
  }
}
