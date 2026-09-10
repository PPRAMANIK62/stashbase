/**
 * Workspace fixtures: listings, library snapshots, and every port as a `vi.fn`.
 *
 * Only shapes and stubs live here. Nothing outside `app/` or `features/` may
 * hold a feature value, so a test that needs a live runtime builds it from the
 * feature's public entry and takes its options from `workspaceRuntimeOptions`.
 */
import { vi } from 'vite-plus/test';

import type {
  ClipboardCapturePort,
  ClipboardImageOffer,
  FilesPort,
  LibraryFolderPickerPort,
  LibraryLifecyclePort,
  LibraryPort,
  UploadPort,
  WorkspacePreferencesPort,
  WorkspaceQueryScope,
  WorkspaceSessionPort,
} from '@/features/workspace/application/ports';
import type { WorkspaceRuntimeOptions } from '@/features/workspace/application/runtime';
import type { ActiveLibraryFolder, LibrarySnapshot } from '@/features/workspace/domain/library';
import type {
  FolderSessionState,
  WorkspaceSessionSnapshot,
} from '@/features/workspace/domain/session';
import type {
  WorkspaceFile,
  WorkspaceFolder,
  WorkspaceListing,
} from '@/features/workspace/domain/tree';
import type { WorkspaceAdapters } from '@/features/workspace/infrastructure/adapters';

export const RESEARCH_FOLDER: ActiveLibraryFolder = { name: 'Research', path: '/Library/Research' };

/** One readable Markdown file in a listing. Tests name only what they assert
 *  on — usually the path and format. */
export function listingFile(overrides: Partial<WorkspaceFile> = {}): WorkspaceFile {
  return {
    availability: 'available',
    format: 'md',
    heading: '',
    importedAt: '',
    kind: 'regular',
    path: 'notes.md',
    size: 12,
    snippet: '',
    ...overrides,
  };
}

export function listingFolder(overrides: Partial<WorkspaceFolder> = {}): WorkspaceFolder {
  return { kind: 'normal', path: 'lessons', ...overrides };
}

/** A listing built from bare file paths, listing files, or a mix. */
export function listing(
  files: readonly (WorkspaceFile | string)[] = [],
  folders: readonly (WorkspaceFolder | string)[] = [],
  folderName = RESEARCH_FOLDER.name,
): WorkspaceListing {
  return {
    files: files.map((file) => (typeof file === 'string' ? listingFile({ path: file }) : file)),
    folderName,
    showHiddenFiles: false,
    folders: folders.map((folder) =>
      typeof folder === 'string' ? listingFolder({ path: folder }) : folder,
    ),
  };
}

export function librarySnapshot(overrides: Partial<LibrarySnapshot> = {}): LibrarySnapshot {
  return {
    activeFolder: RESEARCH_FOLDER,
    homeDirectory: '/home/person',
    members: [
      { favorite: false, openedAt: '2026-09-02T00:00:00.000Z', path: RESEARCH_FOLDER.path },
    ],
    ...overrides,
  };
}

export function filesApi(overrides: Partial<FilesPort> = {}): FilesPort {
  return {
    createEntry: vi.fn(async () => ({ path: 'new.md' })),
    deleteEntry: vi.fn(async () => undefined),
    load: vi.fn(async () => listing()),
    renameEntry: vi.fn(async () => ({ path: 'renamed.md' })),
    reveal: vi.fn(async () => undefined),
    ...overrides,
  };
}

export function libraryApi(overrides: Partial<LibraryPort> = {}): LibraryPort {
  return {
    load: vi.fn(async () => librarySnapshot()),
    openFolder: vi.fn(async () => librarySnapshot()),
    removeFolder: vi.fn(async () => librarySnapshot({ activeFolder: null, members: [] })),
    ...overrides,
  };
}

/** A library whose load never settles, so the shell stays in its restoring
 *  state and no folder ever becomes active. */
export function pendingLibraryApi(): LibraryPort {
  return libraryApi({ load: vi.fn(() => new Promise<never>(() => undefined)) });
}

export function libraryLifecycle(
  overrides: Partial<LibraryLifecyclePort> = {},
): LibraryLifecyclePort {
  return {
    notifyFolderRemoved: vi.fn(async () => undefined),
    onFolderRemoved: vi.fn(() => () => undefined),
    onPrepareFolderRemoval: vi.fn(() => () => undefined),
    prepareFolderRemoval: vi.fn(async () => true),
    setActiveFolder: vi.fn(async () => undefined),
    ...overrides,
  };
}

export function folderPicker(
  overrides: Partial<LibraryFolderPickerPort> = {},
): LibraryFolderPickerPort {
  return { chooseFolder: vi.fn(async () => ({ status: 'cancelled' as const })), ...overrides };
}

export function uploadApi(overrides: Partial<UploadPort> = {}): UploadPort {
  return { upload: vi.fn(async () => []), ...overrides };
}

/** The desktop clipboard watch, plus a hook so a test can offer an image the
 *  way the watch would. */
export function clipboardCapture(
  overrides: Partial<ClipboardCapturePort> = {},
): ClipboardCapturePort & { emit(offer: ClipboardImageOffer): void } {
  const handlers = new Set<(offer: ClipboardImageOffer) => void>();
  return {
    refresh: vi.fn(),
    settle: vi.fn(),
    subscribe: vi.fn((handler: (offer: ClipboardImageOffer) => void) => {
      handlers.add(handler);
      return () => handlers.delete(handler);
    }),
    ...overrides,
    emit: (offer) => handlers.forEach((handler) => handler(offer)),
  };
}

/** One folder's saved presentation state. Tests name it through this builder
 *  rather than through the Workspace feature's public surface: the shape is a
 *  fixture detail, and the running app only ever reads it back off the
 *  session controller. */
export function folderSession(overrides: Partial<FolderSessionState> = {}): FolderSessionState {
  return {
    activeTabId: null,
    expandedPaths: [],
    folderPath: RESEARCH_FOLDER.path,
    selectedPath: null,
    tabs: [],
    ...overrides,
  };
}

export function sessionPersistence(
  overrides: Partial<WorkspaceSessionPort> = {},
): WorkspaceSessionPort {
  return {
    load: vi.fn(async (): Promise<WorkspaceSessionSnapshot | null> => null),
    save: vi.fn(async () => undefined),
    ...overrides,
  };
}

function workspaceQueryScope(overrides: Partial<WorkspaceQueryScope> = {}): WorkspaceQueryScope {
  return { cancel: vi.fn(async () => undefined), remove: vi.fn(), ...overrides };
}

/** Options for `createWorkspaceRuntime`; generation 1 and a settled query
 *  scope are what every test that does not care about them wants. */
export function workspaceRuntimeOptions(
  overrides: Partial<WorkspaceRuntimeOptions> = {},
): WorkspaceRuntimeOptions {
  return {
    folder: RESEARCH_FOLDER,
    generation: 1,
    queries: workspaceQueryScope(),
    ...overrides,
  };
}

/** Hidden entries off by default, matching the server's own default and its
 *  recovery for invalid stored state. */
export function workspacePreferences(
  overrides: Partial<WorkspacePreferencesPort> = {},
): WorkspacePreferencesPort {
  return {
    load: vi.fn(async () => false),
    setShowHiddenFiles: vi.fn(async (next: boolean) => next),
    ...overrides,
  };
}

/** Every Workspace port, as one record. Override one entry at a time. */
export function workspaceAdapters(overrides: Partial<WorkspaceAdapters> = {}): WorkspaceAdapters {
  return {
    clipboardCapture: null,
    files: filesApi(),
    library: libraryApi(),
    lifecycle: libraryLifecycle(),
    preferences: workspacePreferences(),
    session: sessionPersistence(),
    upload: uploadApi(),
    ...overrides,
  };
}
