/** The preload capability for keeping this build up to date. Absent in the web
 *  build, and absent in a desktop build that has no updater behind it.
 *
 *  Nothing here is typed from the wire schema on purpose: preload is another
 *  process, so every answer arrives as `unknown` and is parsed in the feature's
 *  infrastructure before anything reads it. */
export interface UpdatesBridge {
  check(): Promise<unknown>;
  onSnapshot(handler: (snapshot: unknown) => void): () => void;
  openReleasePage(): Promise<unknown>;
  primaryAction(): Promise<unknown>;
  read(): Promise<unknown>;
  setAutoCheck(enabled: boolean): Promise<unknown>;
}

export function isUpdatesBridge(value: unknown): value is UpdatesBridge {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.check === 'function' &&
    typeof candidate.onSnapshot === 'function' &&
    typeof candidate.openReleasePage === 'function' &&
    typeof candidate.primaryAction === 'function' &&
    typeof candidate.read === 'function' &&
    typeof candidate.setAutoCheck === 'function'
  );
}
