import { vi } from 'vite-plus/test';

import type {
  PreparationControlPort,
  PreparationStatusPort,
} from '@/features/preparation/application/ports';
import type { FolderIndexStatus } from '@/shared/domain/folder-index-status';

import { RESEARCH_FOLDER } from './workspace';

/** A settled folder: nothing queued, nothing failed, AI Index unavailable
 *  until a test turns it on. */
export function folderIndexStatus(overrides: Partial<FolderIndexStatus> = {}): FolderIndexStatus {
  return {
    blockedConversions: [],
    conversionProgress: {},
    conversionRevision: 1,
    conversionVersions: {},
    folderPath: RESEARCH_FOLDER.path,
    indexSettled: true,
    indexWarning: null,
    indexed: 0,
    pendingConversions: [],
    preparationFailures: [],
    semantic: { state: 'not-set-up' },
    total: 0,
    treeVersion: 1,
    ...overrides,
  };
}

export function preparationStatusApi(
  overrides: Partial<PreparationStatusPort> = {},
): PreparationStatusPort {
  return { load: vi.fn(async () => folderIndexStatus()), ...overrides };
}

export function preparationControlApi(
  overrides: Partial<PreparationControlPort> = {},
): PreparationControlPort {
  return {
    cancel: vi.fn(async () => true),
    prepare: vi.fn(async () => undefined),
    reprocess: vi.fn(async () => 'conversion' as const),
    sync: vi.fn(async () => true),
    ...overrides,
  };
}
