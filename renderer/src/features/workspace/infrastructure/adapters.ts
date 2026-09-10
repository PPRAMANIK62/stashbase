import type {
  ClipboardCapturePort,
  FilesPort,
  GitHubImportPort,
  LibraryLifecyclePort,
  LibraryPort,
  UploadPort,
  WorkspacePreferencesPort,
  WorkspaceSessionPort,
} from '@/features/workspace/application/ports';
import type { CaptureBridge } from '@/platform/electron/capture';
import type { LibraryBridge } from '@/platform/electron/folder-picker';
import type { LibraryLifecycleBridge } from '@/platform/electron/library-lifecycle';
import type { HttpClient } from '@/platform/http/client';

import { createLibraryAdapter } from './api';
import { createClipboardCaptureAdapter } from './capture-api';
import { createFilesAdapter } from './files-api';
import { createGitHubImportAdapter } from './github-import-api';
import { createLibraryLifecycleAdapter } from './library-lifecycle';
import type { WorkspaceSessionBridge } from './session-persistence';
import { createWorkspaceSessionAdapter } from './session-persistence';
import { createUploadAdapter } from './upload-api';
import { createWorkspacePreferencesAdapter } from './workspace-preferences-api';

/** Every port the Workspace feature needs a real implementation of, in one
 *  record so the app wires the feature rather than its five transports. */
export interface WorkspaceAdapters {
  /** The desktop clipboard watch, or null where the host offers none. */
  clipboardCapture: ClipboardCapturePort | null;
  files: FilesPort;
  githubImport: GitHubImportPort;
  library: LibraryPort;
  lifecycle: LibraryLifecyclePort;
  preferences: WorkspacePreferencesPort;
  session: WorkspaceSessionPort;
  upload: UploadPort;
}

export interface WorkspaceAdapterOptions {
  /** The desktop clipboard capability, absent outside Electron. */
  capture: CaptureBridge | null;
  http: HttpClient;
  library: LibraryBridge & LibraryLifecycleBridge;
  serverOrigin: string;
  workspaceSession: WorkspaceSessionBridge;
}

/**
 * The Workspace feature, bound to this window's transports.
 *
 * Two of these ports are HTTP, three are desktop bridges and one is a raw
 * upload against the server origin; which is which is the feature's own
 * business, and naming them all at the app's wiring site made every change to
 * that split an app change. A host without a clipboard watch simply has no
 * capture port, which is the one absence a caller has to handle.
 */
export function createWorkspaceAdapters({
  capture,
  http,
  library,
  serverOrigin,
  workspaceSession,
}: WorkspaceAdapterOptions): WorkspaceAdapters {
  return {
    clipboardCapture: capture ? createClipboardCaptureAdapter(capture) : null,
    files: createFilesAdapter(http),
    githubImport: createGitHubImportAdapter(http),
    library: createLibraryAdapter(http),
    preferences: createWorkspacePreferencesAdapter(http),
    lifecycle: createLibraryLifecycleAdapter(library),
    session: createWorkspaceSessionAdapter(workspaceSession),
    upload: createUploadAdapter(serverOrigin),
  };
}
