import os from 'node:os';
import path from 'node:path';

const APP_NAME = 'StashBase';

export function appDataRoot(): string {
  if (process.env.STASHBASE_LOCAL_DATA_ROOT?.trim()) {
    return path.resolve(process.env.STASHBASE_LOCAL_DATA_ROOT.trim());
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', APP_NAME);
  }
  if (process.platform === 'win32') {
    return path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), APP_NAME);
  }
  return path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'), APP_NAME);
}

export function appStateDbPath(): string {
  return path.join(appDataRoot(), 'state', 'state.db');
}

export function fileOrderDir(): string {
  return path.join(appDataRoot(), 'file-order');
}

/** Encrypted crash-recovery drafts. Lives outside every project folder so
 *  sync, backups, listing, and indexing never see it. */
export function recoveryJournalDir(): string {
  return path.join(appDataRoot(), 'recovery-journal');
}

/** The single global MFS store root for the whole app. The daemon maps every
 *  member Folder to one Internal namespace below it. `.nosync` keeps iCloud
 *  off the database files even though this
 *  lives under Application Support (which isn't iCloud-synced) — the suffix
 *  is a cheap per-machine guard that travels with the convention. */
export function globalVectorStoreDir(): string {
  return path.join(appDataRoot(), 'vector-store.nosync');
}
