export const ACCOUNT_CHANGED_EVENT = 'stashbase-account-changed';

/**
 * A renderer-only projection of the last account response. `null` means the
 * local server has not answered yet; it is not an anonymous account. Keep the
 * projection here so eager chrome can react to identity without importing the
 * account feature's API and OAuth dependencies into the initial bundle.
 */
let signedInSnapshot: boolean | null = null;
const signedInListeners = new Set<() => void>();

export function accountSignedInSnapshot(): boolean | null {
  return signedInSnapshot;
}

export function subscribeAccountSignedIn(listener: () => void): () => void {
  signedInListeners.add(listener);
  return () => signedInListeners.delete(listener);
}

export function publishAccountSignedIn(signedIn: boolean): void {
  if (signedInSnapshot === signedIn) return;
  signedInSnapshot = signedIn;
  for (const listener of signedInListeners) listener();
}

export function notifyAccountChanged(): void {
  window.dispatchEvent(new CustomEvent(ACCOUNT_CHANGED_EVENT));
}
